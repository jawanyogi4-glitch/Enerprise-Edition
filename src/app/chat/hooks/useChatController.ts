"use client";

// import Prism from "prismjs";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  buildChatUrl,
  nameChatSession,
  updateLlmOverrideForChatSession,
} from "../services/lib";

import { StreamStopInfo } from "@/lib/search/interfaces";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { stopChatSession } from "../chat_search/utils";
import {
  getLastSuccessfulMessageId,
  getLatestMessageChain,
  MessageTreeState,
  upsertMessages,
  SYSTEM_NODE_ID,
  buildImmediateMessages,
  buildEmptyMessage,
} from "../services/messageTree";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { SEARCH_PARAM_NAMES } from "../services/searchParams";
import { qilegalDocument } from "@/lib/search/interfaces";
import { FilterManager, LlmDescriptor, LlmManager } from "@/lib/hooks";
import {
  BackendMessage,
  ChatFileType,
  CitationMap,
  FileChatDisplay,
  FileDescriptor,
  Message,
  MessageResponseIDInfo,
  RegenerationState,
  ResearchType,
  RetrievalType,
  StreamingError,
  ToolCallMetadata,
  UserKnowledgeFilePacket,
} from "../interfaces";
import { StreamStopReason } from "@/lib/search/interfaces";
import { createChatSession } from "../services/lib";
import {
  getFinalLLM,
  modelSupportsImageInput,
  structureValue,
} from "@/lib/llm/utils";
import {
  CurrentMessageFIFO,
  updateCurrentMessageFIFO,
} from "../services/currentMessageFIFO";
import { buildFilters } from "@/lib/search/utils";
import { PopupSpec } from "@/components/admin/connectors/Popup";
import {
  ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useChatContext } from "@/refresh-components/contexts/ChatContext";
import {
  useChatSessionStore,
  useCurrentMessageTree,
  useCurrentChatState,
  useCurrentMessageHistory,
} from "../stores/useChatSessionStore";
import {
  Packet,
  CitationDelta,
  MessageStart,
  PacketType,
} from "../services/streamingModels";
import { useAgentsContext } from "@/refresh-components/contexts/AgentsContext";
import { ProjectFile, useProjectsContext } from "../projects/ProjectsContext";
import { useAppParams } from "@/hooks/appNavigation";
import { projectFilesToFileDescriptors } from "../services/fileUtils";

const SYSTEM_MESSAGE_ID = -3;

export interface OnSubmitProps {
  message: string;
  //from chat input bar
  currentMessageFiles: ProjectFile[];
  // from the chat bar???

  useAgentSearch: boolean;

  // optional params
  messageIdToResend?: number;
  queryOverride?: string;
  forceSearch?: boolean;
  isSeededChat?: boolean;
  modelOverride?: LlmDescriptor;
  regenerationRequest?: RegenerationRequest | null;
  overrideFileDescriptors?: FileDescriptor[];
}

interface RegenerationRequest {
  messageId: number;
  parentMessage: Message;
  forceSearch?: boolean;
}

interface UseChatControllerProps {
  filterManager: FilterManager;
  llmManager: LlmManager;
  liveAssistant: MinimalPersonaSnapshot | undefined;
  availableAssistants: MinimalPersonaSnapshot[];
  existingChatSessionId: string | null;
  selectedDocuments: qilegalDocument[];
  searchParams: ReadonlyURLSearchParams;
  setPopup: (popup: PopupSpec) => void;

  // scroll/focus related stuff
  clientScrollToBottom: (fast?: boolean) => void;

  resetInputBar: () => void;
  setSelectedAssistantFromId: (assistantId: number | null) => void;
  onCaseAnalysisConfidenceChange?: (value: number | null) => void;
  onCaseAnalysisStartedChange?: (value: boolean) => void;
  onCaseAnalysisReasoningChange?: (value: string | null) => void;  
}

export function useChatController({
  filterManager,
  llmManager,
  availableAssistants,
  liveAssistant,
  existingChatSessionId,
  selectedDocuments,

  // scroll/focus related stuff
  clientScrollToBottom,

  setPopup,
  resetInputBar,
  setSelectedAssistantFromId,
  onCaseAnalysisConfidenceChange,
  onCaseAnalysisStartedChange,
  onCaseAnalysisReasoningChange,  
}: UseChatControllerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useAppParams();
  const { refreshChatSessions } = useChatContext();
  const { agentPreferences: assistantPreferences, forcedToolIds } =
    useAgentsContext();
  const { fetchProjects, uploadFiles, setCurrentMessageFiles, beginUpload } =
    useProjectsContext();
  const posthog = usePostHog();

  // Use selectors to access only the specific fields we need
  const currentSessionId = useChatSessionStore(
    (state) => state.currentSessionId
  );
  const sessions = useChatSessionStore((state) => state.sessions);

  // Store actions - these don't cause re-renders
  const updateChatStateAction = useChatSessionStore(
    (state) => state.updateChatState
  );
  const updateRegenerationStateAction = useChatSessionStore(
    (state) => state.updateRegenerationState
  );
  const updateCanContinueAction = useChatSessionStore(
    (state) => state.updateCanContinue
  );
  const createSession = useChatSessionStore((state) => state.createSession);
  const setCurrentSession = useChatSessionStore(
    (state) => state.setCurrentSession
  );
  const updateSessionMessageTree = useChatSessionStore(
    (state) => state.updateSessionMessageTree
  );
  const abortSession = useChatSessionStore((state) => state.abortSession);
  const updateSubmittedMessage = useChatSessionStore(
    (state) => state.updateSubmittedMessage
  );
  const updateSelectedNodeForDocDisplay = useChatSessionStore(
    (state) => state.updateSelectedNodeForDocDisplay
  );
  const setUncaughtError = useChatSessionStore(
    (state) => state.setUncaughtError
  );
  const setLoadingError = useChatSessionStore((state) => state.setLoadingError);
  const setAbortController = useChatSessionStore(
    (state) => state.setAbortController
  );
  //
  const prevSessionIdRef = useRef<string | null>(null);  

  // CASE ANALYSIS CONSTANTS, FUNCTIONS, HOOKS
  const setIsReady = useChatSessionStore((state) => state.setIsReady);
        const ASSISTANT_ID_CASE_ANALYSIS = 1;
        const ASSISTANT_ID_LEGACY_SEARCH = 2; 
        // const [gaugeSize, setGaugeSize] = useState(calculateGaugeSize());
        // const [caseAnalysisConfidence, setCaseAnalysisConfidence] = useState<number | null>(null);
        // const [hasCaseAnalysisStarted, setHasCaseAnalysisStarted] = useState(false);
        // const [caseAnalysisReasoning, setCaseAnalysisReasoning] = useState<string | null>(null);

        // function calculateGaugeSize() {
        // const width = window.innerWidth;
        // if (width < 640) return 112;
        // if (width < 768) return 144;
        // return Math.min(144, width * 0.1);
        // }

        // useEffect(() => {
        //   const handleResize = () => {
        //     setGaugeSize(calculateGaugeSize());
        //   };
        //   window.addEventListener("resize", handleResize);
        //   return () => window.removeEventListener("resize", handleResize);
        // }, []);

          // Helper function to create legacy search messages
          const createLegacySearchMessages = (
            userMessageText: string,
            assistantMessageText: string
          ) => {
            // Create initial nodes similar to onSubmit
            const initialUserNode = buildEmptyMessage({
              messageType: "user",
              parentNodeId: SYSTEM_NODE_ID,
              nodeIdOffset: 0,
            });

            const initialAssistantNode = buildEmptyMessage({
              messageType: "assistant",
              parentNodeId: initialUserNode.nodeId,
              nodeIdOffset: 1,
            });

            const userMessage = { 
              ...initialUserNode,
              message: userMessageText,
            };

            // Generate a stable messageId for user message if undefined
            const userMessageId = userMessage.messageId || Date.now();
            const assistantMessageId = userMessageId + 1;

            const assistantMessage = {
              ...initialAssistantNode,
              parentNodeId: userMessage.nodeId,
              messageId: assistantMessageId, // ← FIXED: Use the calculated ID
              message: assistantMessageText,
              packets: [
                {
                  ind: 0,
                  obj: {
                    type: "message_start" as const,
                    id: `legacy-start-${assistantMessageId}`, // ← FIXED: Use the calculated ID
                    content: assistantMessageText,
                    final_documents: null,
                  },
                },
                {
                  ind: 1,
                  obj: {
                    type: "stop" as const,
                  },
                },
              ],
              childrenNodeIds: [],
              latestChildNodeId: null,
            };

            // Ensure user message also has the stable ID
            const userMessageWithId = {
              ...userMessage,
              messageId: userMessageId,
            };

            return { userMessage: userMessageWithId, assistantMessage };
          };        

        // LEGACY SEARCH CONSTANTS, FUNCTIONS, HOOKS

          // Search Domain
          const [searchDomain, setSearchDomain] = useState<'judgements' | 'statutes'>('judgements');
          // Selected Courts
          const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
          
          // 
          const [searchHistory, setSearchHistory] = useState<
            { id: string; query: string; results: any[]; meta?: LegacyMeta }[]
          >([]);  
          //
          const [loadingPageFor, setLoadingPageFor] = useState<string | null>(null);
          // 
          const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
          // 
            const [refineSnippetsByIndex, setRefineSnippetsByIndex] = useState<Record<number, { match_count: number; snippets: string[] }>>({});
            // 
            const [pager, setPager] = useState<Record<string, JudgementsPagerEntry | StatutesPagerEntry>>({}); 
            // Cleaner 
            useEffect(() => {
              // LOGIC START: Check if we are transitioning from "New Chat" (null) to a valid ID.
              // If so, we are just starting the conversation and should NOT clear the filters 
              // the user just selected.
              const isInitializingNewSession = !prevSessionIdRef.current && currentSessionId;
              
              // Update the ref for the next render
              prevSessionIdRef.current = currentSessionId;

              if (isInitializingNewSession) {
                return; 
              }
              setSearchHistory([]);
              setSelectedQueryId(null);
              setPager({});
              setRefineSnippetsByIndex({});
              setLoadingPageFor(null);
              setIsSearching(false);
              setKeywords([]);
              setJudgeName("");
              setCaseName("");
              setSectionTitle("");
              setSelectedCourts([]);
              setSelectedStatutes([]);
              setState([{ startDate: null, endDate: null, key: "selection" }]);
              setLastAppliedSummary("");
            }, [currentSessionId]);            
            // === Mixed-scope helpers (SC + HC) ===
            const bothCourtsSelected = (courts: string[]) => {
              const hasSC = courts.some((c) => c.trim().toLowerCase() === "supreme court");
              const hasHC = courts.some((c) => c.trim().toLowerCase() !== "supreme court");
              return hasSC && hasHC;
            };  
            //
            const highCourtsFrom = (courts: string[]) =>
              courts.filter((c) => c.trim().toLowerCase() !== "supreme court");       
            // === Statutes UI state ===
              const [selectedStatutes, setSelectedStatutes] = useState<string[]>([]);            
            // 
            function headerLine(fromIdx: number, count: number, total: number | undefined, sc?: number, hc?: number) {
              const from = total ? Math.min(fromIdx + 1, total) : fromIdx + 1;
              const to = total ? Math.min(fromIdx + count, total) : fromIdx + count;
              const totalStr = total != null ? ` of ${total}` : "";
              const breakdown =
                sc != null || hc != null ? ` _(SC: ${sc ?? 0}, HC: ${hc ?? 0})_` : "";
              return `**Showing ${from}–${to}${totalStr} results**${breakdown}.`;
            }    
            //
            function headerLineStatutes(
              fromIdx: number,
              count: number,
              total: number | undefined,
              central?: number,
              state?: number
            ) {
              const from = total ? Math.min(fromIdx + 1, total) : fromIdx + 1;
              const to = total ? Math.min(fromIdx + count, total) : fromIdx + count;
              const totalStr = total != null ? ` of ${total}` : "";
              const breakdown =
                central != null || state != null
                  ? ` _(Central: ${central ?? 0}, States: ${state ?? 0})_`
                  : "";
              return `**Showing ${from}–${to}${totalStr} results**${breakdown}.`;
            }     
            //
            function formatSnippet(snippet: string): string {
              // Regex explains: find <mark>, capture the text inside (group 1), find </mark>
              // Replace with: ***UPPERCASE TEXT***
              return snippet.replace(/<mark>(.*?)<\/mark>/g, (match, content) => {
                return `***${content.toUpperCase()}***`;
              });
            }                
            // render rows with a starting index so numbering continues across pages
            function renderRowsChunk(rows: any[], startIndex: number, snippetsMap?: Record<number, string[]>) {
              return rows.map((r, i) => {
                  // Pass the specific snippets for this row index (relative to the chunk)
                  const rowSnippets = snippetsMap ? snippetsMap[i] : undefined;
                  // We must pass the 3rd argument (rowSnippets) to renderAnyRow -> renderSCBlock
                  return renderAnyRow(r, startIndex + i, rowSnippets);
              }).join(`\n\n---\n\n`);
            }        
              //             
              function renderSCEmptyBlock(idx: number) {
                return [
                  `### ${idx + 1}. Supreme Court — **file_name:** —`,
                  `_No Supreme Court results matched your filters._`,
                  ``,
                  `**Case No.:** —`,
                  `**Citation:** —`,
                  `**Bench:** —`,
                  `**Judgement By:** —`,
                  `**Judgment date:** —`,
                  ``,
                  `---`,
                  ``,
                  `**Content:**`,
                  `> —`,
                ].join("\n");
              }
            // 
              function renderHCEmptyBlock(r: any, idx: number) {
                const court = r["Court name"] || "—";
                return [
                  `### ${idx + 1}. High Court — **Court name:** ${court}`,
                  `_No High Court results matched your filters for the selected court(s)._`,
                  ``,
                  `**Case number:** —`,
                  `**CNR:** —`,
                  `**Decision date:** —`,
                  `**Disposal nature:** —`,
                  `**Judge:** —`,
                  ``,
                  `---`,
                  ``,
                  `**Text:**`,
                  `> —`,
                ].join("\n");
              } 
                  // FULL body (no truncation). SC => content/all_text, HC => text/all_text
                  function getFullBodyFromRow(r: any): string {
                    return r.source === "SC"
                      ? String(r.content || r.all_text || "")
                      : String(r.text || r.all_text || "");
                  }              
                // Quote multiline text as blockquote (no HTML)
                function toBlockquote(str: string) {
                  return String(str)
                    .split("\n")
                    .map((line) => `> ${line}`)
                    .join("\n");
                }              
              // SC block — all fields + full content
              // SC block — all fields + full content (no source/collection)
              function renderSCBlock(r: any, idx: number, snippets?: string[]) {
                const fileName = r.file_name || "Untitled";
                const caseNo = r.case_no || "—";
                const citation = r.citation || "—";
                const bench = r.bench || "—";
                const judgeBy = r.judgement_by || bench || "—";
                const jdate = r.judgment_dates || "—";

                let bodyBlock = "";
                // LOGIC: If we have refined snippets, format them.
                // REMOVED toBlockquote() wrapper to prevent overall italics/styling
                if (snippets && snippets.length > 0) {
                    const formatted = snippets.map(s => formatSnippet(s)).join("\n\n");
                    bodyBlock = formatted; 
                } else {
                    bodyBlock = getFullBodyFromRow(r);
                }

                return [
                  `### ${idx + 1}. Supreme Court — **file_name:** ${fileName}`,
                  `**Case No.:** ${caseNo}`,
                  `**Citation:** ${citation}`,
                  `**Bench:** ${bench}`,
                  `**Judgement By:** ${judgeBy}`,
                  `**Judgment date:** ${jdate}`,
                  ``,
                  `---`,
                  ``,
                  `**Content:**`,
                  bodyBlock,
                ].join("\n");
              }
              // HC block — all fields + full text
              function renderHCBlock(r: any, idx: number, snippets?: string[]) {
                const court = r["Court name"] || r["Court Name"] || "—";
                const title = r.title || "Untitled";
                const caseNumber = r["case number"] || r["Case Number"] || "—";
                const cnr = r["cnr"] || "—";
                const decisionDate = r["decision date"] || r["Decision Date"] || "—";
                const disposalNature = r["disposal nature"] || r["Disposal Nature"] || "—";
                const judge = r.judge || r["Judge"] || "—";

                let bodyBlock = "";
                // LOGIC: Use full highlighted text if available
                // REMOVED toBlockquote() wrapper to prevent overall italics/styling
                if (snippets && snippets.length > 0) {
                    const formatted = snippets.map(s => formatSnippet(s)).join("\n\n");
                    bodyBlock = formatted;
                } else {
                    bodyBlock = getFullBodyFromRow(r);
                }

                return [
                  `### ${idx + 1}. High Court — **Court name:** ${court} — **Title:** ${title}`,
                  `**Case number:** ${caseNumber}`,
                  `**CNR:** ${cnr}`,
                  `**Decision date:** ${decisionDate}`,
                  `**Disposal nature:** ${disposalNature}`,
                  `**Judge:** ${judge}`,
                  ``,
                  `---`,
                  ``,
                  `**Text:**`,
                  bodyBlock,
                ].join("\n");
              }
              //
              function getFullBodyFromStatuteRow(r: any): string {
                // Only read the full field; do NOT fall back to snippet-like keys.
                return String(r["section text"] ?? r["Section Text"] ?? "");
              }              
              // UPDATED: Now accepts snippets for highlighting
              function renderCentralActBlock(r: any, idx: number, snippets?: string[]) {
                const statute = r["name of statute"] ?? r["Name of Statute"] ?? "—";
                const secNo = r["section number"] ?? r["Section Number"] ?? "—";
                const secTitle = r["section title"] ?? r["Section Title"] ?? "—";
                
                let bodyBlock = "";
                // LOGIC: Use full highlighted text if available
                // REMOVED toBlockquote() wrapper to prevent overall italics/styling
                if (snippets && snippets.length > 0) {
                   const formatted = snippets.map(s => formatSnippet(s)).join("\n\n");
                   bodyBlock = formatted;
                } else {
                   bodyBlock = getFullBodyFromStatuteRow(r);
                }

                return [
                  `### ${idx + 1}. Central Act — ${statute}`,
                  `**name of statute:** ${statute}`,
                  `**section number:** ${secNo}`,
                  `**section title:** ${secTitle}`,
                  ``,
                  `---`,
                  ``,
                  `**section text:**`,
                  bodyBlock,
                ].join("\n");
              }

              // UPDATED: Now accepts snippets for highlighting
              function renderStateActBlock(r: any, idx: number, snippets?: string[]) {
                const stateName = r["state name"] ?? r["State Name"] ?? "—";
                const statute = r["name of statute"] ?? r["Name of Statute"] ?? "—";
                const secNo = r["section number"] ?? r["Section Number"] ?? "—";
                const secTitle = r["section title"] ?? r["Section Title"] ?? "—";
                
                let bodyBlock = "";
                // LOGIC: Use full highlighted text if available
                // REMOVED toBlockquote() wrapper to prevent overall italics/styling
                if (snippets && snippets.length > 0) {
                   const formatted = snippets.map(s => formatSnippet(s)).join("\n\n");
                   bodyBlock = formatted;
                } else {
                   bodyBlock = getFullBodyFromStatuteRow(r);
                }

                return [
                  `### ${idx + 1}. ${stateName} — ${statute}`,
                  `**state name:** ${stateName}`,
                  `**name of statute:** ${statute}`,
                  `**section number:** ${secNo}`,
                  `**section title:** ${secTitle}`,
                  ``,
                  `---`,
                  ``,
                  `**section text:**`,
                  bodyBlock,
                ].join("\n");
              }            
              // UPDATED: Now accepts snippets (optional)
              const renderAnyRowStatutes = (r: any, i: number, snippets?: string[]) =>
                r.source === "CENTRAL" 
                  ? renderCentralActBlock(r, i, snippets) 
                  : renderStateActBlock(r, i, snippets);              
              //
              // UPDATED: Now accepts snippetsMap (optional)
              function renderRowsChunkStatutes(rows: any[], startIndex: number, snippetsMap?: Record<number, string[]>) {
                return rows.map((r, i) => {
                    const rowSnippets = snippetsMap ? snippetsMap[i] : undefined;
                    return renderAnyRowStatutes(r, startIndex + i, rowSnippets);
                }).join(`\n\n---\n\n`);
              }             
              //
              async function fetchStatutesPage(params: StatutesQueryParams, page: number, useAdvanced: boolean) {
                try {
                  const url = useAdvanced
                    ? "/api/legacysearch/statutes/advanced"
                    : "/api/legacysearch/statutes/search";

                  const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...params, page }),
                  });
                  if (!resp.ok) {
                    return { results: [], total: 0, central_total: 0, state_total: 0, has_more: false };
                  }
                  const data = await resp.json();
                  return data; // { results, total, central_total, state_total, page, page_size, has_more }
                } catch {
                  return { results: [], total: 0, central_total: 0, state_total: 0, has_more: false };
                }
              }                                      
            // 
            const renderAnyRow = (r: any, i: number, snippets?: string[]) => {
              if (r.__empty && r.source === "SC") return renderSCEmptyBlock(i);
              if (r.__empty && r.source === "HC") return renderHCEmptyBlock(r, i);
              return r.source === "SC" ? renderSCBlock(r, i, snippets) : renderHCBlock(r, i, snippets);
            };                                          
          // Synthetic "empty" rows so we can render a visible empty-state block
          const buildEmptySCRow = () => ({
            source: "SC",
            collection: "sc_cases",
            __empty: true,
            file_name: "—",
            case_no: null,
            citation: null,
            bench: null,
            judgement_by: null,
            content: "",
            judgment_dates: null,
          });

          const buildEmptyHCRow = (hcList: string[]) => ({
            source: "HC",
            collection: "hc_cases",
            __empty: true,
            "Court name": hcList.join(", ") || "—",
            title: null,
            "case number": null,
            cnr: null,
            "decision date": null,
            "disposal nature": null,
            judge: null,
            text: "",
          });                                         
          // Query Params
          type QueryParams = {
            query: string;
            courts: string[];
            judge_name: string | null;
            case_title: string | null;
            start_date: string | null; // yyyy-mm-dd or null
            end_date: string | null;   // yyyy-mm-dd or null
            page_size: number;         // 5
            // store refine keywords the user applied at "Apply" time so we can re-apply on later pages
            keywords: string[];
            keyword_logic?: "AND" | "OR";
          }; 
            // Pager types (judgements vs statutes)
            type PagerEntryBase<TParams> = {
              domain: 'judgements' | 'statutes';
              currentPage: number;          // 1-based
              totalPages: number;           // ceil(total / page_size)
              total?: number;               // convenience
              pageSize: number;
              hasMore: boolean;
              params: TParams;
              cache?: Record<number, any[]>; // page -> results[]
            };  
            // Statutes query params (separate from judgements)
            type StatutesQueryParams = {
              query: string;           // free text
              statutes: string[];      // e.g. ["Central Acts", "Assam", "West Bengal"]
              section_title: string | null; // for Advanced: "Search within Section Title"
              page_size: number;       // 5
              keywords: string[];      // refine terms to re-apply on later pages
              keyword_logic?: "AND" | "OR";
            };                    
          type LegacyMeta = {
            // judgements
            sc_total?: number;
            hc_total?: number;
            // statutes
            central_total?: number;
            state_total?: number;

            total?: number;
            page?: number;          // current loaded page (1-based)
            page_size?: number;     // usually 5
            has_more?: boolean;     // if the server has more pages for these params
          };    
          type JudgementsPagerEntry = PagerEntryBase<QueryParams> & {
            domain: 'judgements';
            // When both SC+HC are selected with advanced filters we split calls per source
            mixedSplit?: {
              sc?: { total: number; params: QueryParams; cache: Record<number, any[]> };
              hc?: { total: number; params: QueryParams; cache: Record<number, any[]> };
            };
          };

          type StatutesPagerEntry = PagerEntryBase<StatutesQueryParams> & {
            domain: 'statutes';
          }; 
          //
          const [showPopup, setShowPopup] = useState(false);
          // 
          const [isSearching, setIsSearching] = useState(false);          
          //
          const selectedHistory = selectedQueryId
            ? searchHistory.find(q => q.id === selectedQueryId) || undefined
            : undefined;
          //
          const courtsCacheRef = useRef<string[] | null>(null);
          //
          const statesCacheRef = useRef<string[] | null>(null);            
          //
          const showLegacyPager =
            liveAssistant?.name === "Legacy Search" &&
            searchDomain === "judgements" &&
            !!selectedHistory &&
            !!pager[selectedHistory.id] &&
            pager[selectedHistory.id]?.domain === 'judgements' &&
            (selectedHistory.results?.length ?? 0) > 0 &&
            (pager[selectedHistory.id] as JudgementsPagerEntry)?.totalPages > 1 &&
            !showPopup &&
            !isSearching;

          const showLegacyPagerStatutes =
            liveAssistant?.name === "Legacy Search" &&
            searchDomain === "statutes" &&
            !!selectedHistory &&
            !!pager[selectedHistory.id] &&
            pager[selectedHistory.id]?.domain === 'statutes' &&
            (selectedHistory.results?.length ?? 0) > 0 &&
            (pager[selectedHistory.id] as StatutesPagerEntry)?.totalPages > 1 &&
            !showPopup &&
            !isSearching;  
            
            useEffect(() => {
              if (liveAssistant?.name !== "Legacy Search" || searchDomain !== 'judgements') return;

              let cancelled = false;

              // 1) Hydrate immediately from in-memory or localStorage; fallback already in state.
              const cachedLocal = courtsCacheRef.current || readCachedCourts();
              if (cachedLocal && !cancelled) {
                courtsCacheRef.current = cachedLocal;
                setCourtsList(cachedLocal);
              } else {
                // keep HC_FALLBACK already in state; do NOT block the UI
                setCourtsList(HC_FALLBACK);
              }

              // 2) Background refresh with a short timeout (no visible loader needed)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2500); // abort after 2.5s

              (async () => {
                try {
                  // Only show the loading label if we really have nothing (rare in our setup)
                  if (
                    courtsList.length === 0 &&
                    !(courtsCacheRef.current || cachedLocal || HC_FALLBACK.length)
                  ) {
                    setLoadingCourts(true);
                  }

                  const res = await fetch("/api/legacysearch/judgements/courts", {
                    signal: controller.signal,
                  });
                  if (!res.ok) throw new Error("Failed to load courts");
                  const data = await res.json(); // { supreme, high_courts }

                  const hc = Array.isArray(data.high_courts) ? data.high_courts : [];
                  const finalList = hc.length ? hc : HC_FALLBACK;

                  if (!cancelled && finalList && finalList.length) {
                    courtsCacheRef.current = finalList;
                    setCourtsList(finalList);
                    writeCachedCourts(finalList);
                  }
                } catch (e) {
                  // Network slow/aborted/etc. — user still sees fallback/cached list instantly
                  console.error("Load courts error:", e);
                } finally {
                  if (!cancelled) setLoadingCourts(false);
                  clearTimeout(timeoutId);
                }
              })();

              return () => {
                cancelled = true;
                clearTimeout(timeoutId);
                controller.abort();
              };
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [liveAssistant?.name, searchDomain]);

            useEffect(() => {
              if (liveAssistant?.name !== "Legacy Search" || searchDomain !== 'statutes') return;

              let cancelled = false;

              // 1) Hydrate from localStorage or ref
              const cachedLocal = statesCacheRef.current || readCachedStates();
              if (cachedLocal && !cancelled) {
                statesCacheRef.current = cachedLocal;
                setStatesList(cachedLocal);
              }

              // 2) Background refresh
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2500);

              (async () => {
                try {
                  if (!cachedLocal) setLoadingStates(true);

                  const res = await fetch("/api/legacysearch/statutes/states", { signal: controller.signal });
                  if (!res.ok) throw new Error("Failed to load states");
                  const data = await res.json(); // { central: "Central Acts", states: [...] }

                  const finalList: string[] = Array.isArray(data.states) ? data.states : [];
                  if (!cancelled && finalList.length) {
                    statesCacheRef.current = finalList;
                    setStatesList(finalList);
                    writeCachedStates(finalList);
                  }
                } catch (e) {
                  console.error("Load states error:", e);
                } finally {
                  if (!cancelled) setLoadingStates(false);
                  clearTimeout(timeoutId);
                }
              })();

              return () => {
                cancelled = true;
                clearTimeout(timeoutId);
                controller.abort();
              };
            }, [liveAssistant?.name, searchDomain]);            

  // --- Courts cache (localStorage + in-memory) ---
  const COURTS_CACHE_KEY = "legacy_hc_courts_v1";
  const COURTS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
  const STATES_CACHE_KEY = "legacy_states_v1";
  const STATES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days


  function readCachedCourts(): string[] | null {
    try {
      const raw = localStorage.getItem(COURTS_CACHE_KEY);
      if (!raw) return null;
      const { list, ts } = JSON.parse(raw);
      if (!Array.isArray(list) || !ts) return null;
      if (Date.now() - ts > COURTS_CACHE_TTL_MS) return null; // expired
      return list as string[];
    } catch {
      return null;
    }
  }

  function writeCachedCourts(list: string[]) {
    try {
      localStorage.setItem(
        COURTS_CACHE_KEY,
        JSON.stringify({ list, ts: Date.now() })
      );
    } catch {
      // ignore quota errors
    }
  }

  function readCachedStates(): string[] | null {
    try {
      const raw = localStorage.getItem(STATES_CACHE_KEY);
      if (!raw) return null;
      const { list, ts } = JSON.parse(raw);
      if (!Array.isArray(list) || !ts) return null;
      if (Date.now() - ts > STATES_CACHE_TTL_MS) return null; // expired
      return list as string[];
    } catch {
      return null;
    }
  }

  function writeCachedStates(list: string[]) {
    try {
      localStorage.setItem(
        STATES_CACHE_KEY,
        JSON.stringify({ list, ts: Date.now() })
      );
    } catch {
      // ignore quota errors
    }
  }

  function pageList(current: number, total: number): (number | '…')[] {
    const pages: (number | '…')[] = [];
    const window = 1; // neighbors to show on each side
    if (total <= 10) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (current - window > 2) pages.push('…');
    for (let p = Math.max(2, current - window); p <= Math.min(total - 1, current + window); p++) {
      pages.push(p);
    }
    if (current + window < total - 1) pages.push('…');
    pages.push(total);
    return pages;
  }  

  // Assemble a combined page from SC then HC (by concatenation order)
  async function assembleMixedPage(entry: JudgementsPagerEntry, page: number): Promise<{ rows: any[]; totals: { total: number; sc_total: number; hc_total: number } }> {
    const PAGE = entry.pageSize;
    const start = (page - 1) * PAGE;
    const end = start + PAGE;

    const scTotal = entry.mixedSplit?.sc?.total ?? 0;
    const hcTotal = entry.mixedSplit?.hc?.total ?? 0;
    const grandTotal = scTotal + hcTotal;

    // Early exit: nothing to show
    if (grandTotal === 0) return { rows: [], totals: { total: 0, sc_total: 0, hc_total: 0 } };

    // Which slices belong to SC vs HC
    const takeFromSC = Math.max(0, Math.min(end, scTotal) - Math.min(start, scTotal)); // overlap with [0, scTotal)
    const scFrom = Math.min(start, scTotal);
    const scTo = scFrom + takeFromSC;

    const takeFromHC = PAGE - takeFromSC;
    const hcFrom = Math.max(0, start - scTotal);
    const hcTo = hcFrom + Math.max(0, Math.min(takeFromHC, Math.max(0, hcTotal - hcFrom)));

    // Helper to pull an arbitrary slice from cached pages (fetch missing ones)
    const sliceFromSource = async (kind: "sc" | "hc", from: number, to: number): Promise<any[]> => {
      const src = entry.mixedSplit?.[kind];
      if (!src || to <= from) return [];

      const pageSize = entry.pageSize; // we use same page size per source
      const firstPage = Math.floor(from / pageSize) + 1;
      const lastPage = Math.floor((to - 1) / pageSize) + 1;

      const results: any[] = [];
      for (let p = firstPage; p <= lastPage; p++) {
        if (!src.cache[p]) {
          const data = await fetchJudgementsPage(src.params, p);
          src.cache[p] = Array.isArray(data.results) ? data.results : [];
        }
      }

      // Collect the exact slice [from, to)
      for (let idx = from; idx < to; idx++) {
        const p = Math.floor(idx / pageSize) + 1;
        const offsetInPage = idx % pageSize;
        const pageArr = src.cache[p] || [];
        if (offsetInPage < pageArr.length) {
          results.push(pageArr[offsetInPage]);
        }
      }
      return results;
    };

    const scSlice = await sliceFromSource("sc", scFrom, scTo);
    const hcSlice = await sliceFromSource("hc", hcFrom, hcTo);

    return {
      rows: [...scSlice, ...hcSlice],
      totals: { total: grandTotal, sc_total: scTotal, hc_total: hcTotal },
    };
  }  

          
  // Legacy Search constants, hooks and Functions
  // 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  //
  const [keywordLogic, setKeywordLogic] = useState<"AND" | "OR">("OR");  
  //
  const [pendingStatutes, setPendingStatutes] = useState<string[] | null>(null);
  //
  const [statutesScopeWarnText, setStatutesScopeWarnText] = useState<string>("");  
  // do we currently have any statutes filters filled?
  const haveAnyStatutesFilters = () =>
    (keywords && keywords.length > 0) || (sectionTitle && sectionTitle.trim().length > 0);

  // remember where statutes filters were last applied
  const [lastAppliedStatutesCtx, setLastAppliedStatutesCtx] = useState<{
    scope: StatutesScope;
    sources: string[];
  } | null>(null);  
  //
  const prettyStatutes = (s: StatutesScope) =>
    s === "Central" ? "Central Acts"
      : s === "State" ? "State Acts"
        : "Central + State Acts";
  //
  const [showStatutesScopeWarn, setShowStatutesScopeWarn] = useState(false);          
  //
  type StatutesScope = "Central" | "State" | "Mixed";
  // default [] => Central Acts (backend default), mirroring your courts logic
  const deriveStatutesScopeFromSources = (sources: string[]): StatutesScope => {
    const hasCentral = sources.some((s) => s.trim().toLowerCase() === "central acts");
    const statesOnly = sources.filter((s) => s.trim().toLowerCase() !== "central acts");
    if (hasCentral && statesOnly.length > 0) return "Mixed";
    if (hasCentral || sources.length === 0) return "Central";
    return "State";
  };  
  // Statutes selection helpers
  const isStatuteChecked = (label: string) =>
    selectedStatutes.some((s) => s.trim().toLowerCase() === label.trim().toLowerCase());

  // Toggle helpers for statutes sources (with scope-change guard)
  const toggleStatute = (label: string) => {
    const next = selectedStatutes.includes(label)
      ? selectedStatutes.filter((s) => s !== label)
      : [...selectedStatutes, label];

    const currentScope = deriveStatutesScopeFromSources(selectedStatutes);
    const nextScope = deriveStatutesScopeFromSources(next);

    // WARN ONLY when the user is LEAVING the scope where filters were last applied.
    if (
      lastAppliedStatutesCtx &&
      haveAnyStatutesFilters() &&
      currentScope === lastAppliedStatutesCtx.scope &&
      nextScope !== lastAppliedStatutesCtx.scope
    ) {
      setPendingStatutes(next);
      setStatutesScopeWarnText(
        `Your filters were last applied in ${prettyStatutes(lastAppliedStatutesCtx.scope)}. ` +
        `You're switching to ${prettyStatutes(nextScope)}. Those filters may not match there. ` +
        `Recommended: clear filters and re-apply.`
      );
      setShowStatutesScopeWarn(true);
      return;
    }

    // otherwise change immediately
    setSelectedStatutes(next);
  };  
  //
  const HC_FALLBACK = [
    "Allahabad High Court", "Bombay High Court", "Calcutta High Court", "Gauhati High Court",
    "High Court for State of Telangana", "High Court of Andhra Pradesh", "High Court of Chhattisgarh",
    "High Court of Delhi", "High Court of Gujarat", "High Court of Himachal Pradesh",
    "High Court of Jammu and Kashmir", "High Court of Jharkhand", "High Court of Karnataka",
    "High Court of Kerala", "High Court of Madhya Pradesh", "High Court of Manipur",
    "High Court of Meghalaya", "High Court of Orissa", "High Court of Punjab and Haryana",
    "High Court of Rajasthan", "High Court of Sikkim", "High Court of Tripura",
    "High Court of Uttarakhand", "Madras High Court", "Patna High Court",
  ];   
  //
  const [newKeyword, setNewKeyword] = useState('');
  //
  const [keywords, setKeywords] = useState<string[]>([]); 
  //
  const [showAdvancedOption, setShowAdvancedOption] = useState(false); 
  //
  const [judgeName, setJudgeName] = useState('');
  //
  const [caseName, setCaseName] = useState('');  
  //
  const [showDatePopup, setShowDatePopup] = useState(false);  
  //
  const [pendingCourts, setPendingCourts] = useState<string[] | null>(null);  
  //
  const [scopeWarnText, setScopeWarnText] = useState<string>("");  
  //
  const [showScopeWarn, setShowScopeWarn] = useState(false);
  //
  const [loadingCourts, setLoadingCourts] = useState(false);
  //
  const [courtsList, setCourtsList] = useState<string[]>(HC_FALLBACK);
  //
  const [sectionTitle, setSectionTitle] = useState<string>(""); 
  //
  const [loadingStates, setLoadingStates] = useState(false);
  //
  const [statesList, setStatesList] = useState<string[]>([]);
  // 1. Logic for "Select All" Courts (Supreme Court + All High Courts)
  const isAllCourtsSelected =
    selectedCourts.includes("Supreme Court") &&
    courtsList.length > 0 &&
    courtsList.every((c) => selectedCourts.includes(c));

  const toggleAllCourts = () => {
    if (isAllCourtsSelected) {
      setSelectedCourts([]); // Deselect All
    } else {
      setSelectedCourts(["Supreme Court", ...courtsList]); // Select All
    }
  };

  // 2. Logic for "Select All" Statutes (Central Acts + All States)
  const isAllStatutesSelected =
    selectedStatutes.includes("Central Acts") &&
    statesList.length > 0 &&
    statesList.every((s) => selectedStatutes.includes(s));

  const toggleAllStatutes = () => {
    if (isAllStatutesSelected) {
      setSelectedStatutes([]); // Deselect All
    } else {
      setSelectedStatutes(["Central Acts", ...statesList]); // Select All
    }
  };  
  //
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  //
  const acceptStatutesChangeKeep = () => {
    if (pendingStatutes) setSelectedStatutes(pendingStatutes);
    setPendingStatutes(null);
    setShowStatutesScopeWarn(false);
  };
  //
  const acceptStatutesChangeClear = () => {
    if (pendingStatutes) setSelectedStatutes(pendingStatutes);
    // clear *statutes* filters before re-applying in the new scope
    setKeywords([]);
    setNewKeyword('');
    setSectionTitle('');
    setPendingStatutes(null);
    setShowStatutesScopeWarn(false);
    toast.info("Filters cleared for the selected sources.");
  };
  //
  const cancelStatutesChange = () => {
    setPendingStatutes(null);
    setShowStatutesScopeWarn(false);
  };  
  // handlers for the scope-change dialog
  const acceptCourtChangeKeep = () => {
    if (pendingCourts) setSelectedCourts(pendingCourts);
    setPendingCourts(null);
    setShowScopeWarn(false);
  };
  //
  const acceptCourtChangeClear = () => {
    if (pendingCourts) setSelectedCourts(pendingCourts);
    // clear filters before the user re-applies for the new scope
    setKeywords([]);
    setJudgeName("");
    setCaseName("");
    setState([{ startDate: null, endDate: null, key: "selection" }]);
    setPendingCourts(null);
    setShowScopeWarn(false);
    toast.info("Filters cleared for the selected courts.");
  };
  //
  const cancelCourtChange = () => {
    setPendingCourts(null);
    setShowScopeWarn(false);
  };  
  //
  type Scope = "SC" | "HC" | "Mixed";  
  // default [] => SC (backend default)
  const deriveScopeFromCourts = (courts: string[]): Scope => {
    const hasSC = courts.some((c) => c.trim().toLowerCase() === "supreme court");
    const hcOnly = courts.filter((c) => c.trim().toLowerCase() !== "supreme court");
    if (hasSC && hcOnly.length > 0) return "Mixed";
    if (hasSC || courts.length === 0) return "SC";
    return "HC";
  };  
  // remember where filters were last applied
  const [lastAppliedCtx, setLastAppliedCtx] = useState<{
    scope: Scope;
    courts: string[];
  } | null>(null);
  // do we currently have any filters filled?
  const haveAnyFilters = () =>
    (keywords && keywords.length > 0) ||
    (judgeName && judgeName.trim().length > 0) ||
    (caseName && caseName.trim().length > 0) ||
    (state[0]?.startDate && state[0]?.endDate);

  // Toggle helpers for court checkboxes (with scope-change guard)
  const toggleCourt = (label: string) => {
    const next = selectedCourts.includes(label)
      ? selectedCourts.filter((c) => c !== label)
      : [...selectedCourts, label];

    const currentScope = deriveScopeFromCourts(selectedCourts);
    const nextScope = deriveScopeFromCourts(next);

    // WARN ONLY when the user is LEAVING the scope where filters were last applied.
    // i.e., currentScope must equal lastAppliedCtx.scope, and nextScope must differ.
    if (
      lastAppliedCtx &&
      haveAnyFilters() &&
      currentScope === lastAppliedCtx.scope &&
      nextScope !== lastAppliedCtx.scope
    ) {
      setPendingCourts(next);

      const pretty = (s: Scope) =>
        s === "SC" ? "Supreme Court" : s === "HC" ? "High Courts" : "Supreme + High Courts";

      setScopeWarnText(
        `Your filters were last applied in ${pretty(lastAppliedCtx.scope)}. ` +
        `You're switching to ${pretty(nextScope)}. Those filters may not match there. ` +
        `Recommended: clear filters and re-apply.`
      );
      setShowScopeWarn(true);
      return;
    }

    // otherwise change immediately
    setSelectedCourts(next);
  };  
  //
  const isCourtChecked = (label: string) =>
    selectedCourts.some((c) => c.trim().toLowerCase() === label.trim().toLowerCase());  
  //
  const toggleDatePopup = () => setShowDatePopup(prev => !prev);   
  //
  const [state, setState] = useState<{
    startDate: Date | null;
    endDate: Date | null;
    key: string;
  }[]>([
    { startDate: null, endDate: null, key: 'selection' }
  ]);
  //
  const currentRange = state[0] ?? { startDate: null, endDate: null, key: "selection" };
  //
  // function statutesSearchableText(r: any): string {
  //   const parts = [
  //     r["section text"] ?? r["Section Text"] ?? "",
  //     r["section title"] ?? r["Section Title"] ?? "",
  //     r["name of statute"] ?? r["Name of Statute"] ?? "",
  //     r["state name"] ?? r["State Name"] ?? "",
  //   ];
  //   return parts.join(" ");
  // }
  //
  // function escapeRegExp(s: string) {
  //   return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // }    
  //
  // function statutesMatchesAllKeywordsStrict(r: any, kws: string[]): boolean {
  //   if (!kws || kws.length === 0) return true;
  //   const hay = statutesSearchableText(r);
  //   return kws.every((kw) => {
  //     const trimmed = String(kw || "").trim();
  //     if (!trimmed) return true;
  //     const rx = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i");
  //     return rx.test(hay);
  //   });
  // }   
  //
  const [lastAppliedSummary, setLastAppliedSummary] = useState<string>("");
//  
// function normalizeCaseTitleInput(input: string): string {
//   let s = (input || "").trim();

//   // 1) Keep only the first line if a block was pasted
//   s = (s.split(/\r?\n/)[0] || "").trim(); // Fix: Add fallback for undefined

//   // 2) Strip common markdown/quote/list characters users might copy
//   // (e.g., "**file_name:**", "### 1.", "> ")
//   s = s
//     .replace(/[*_`>]+/g, " ")           // markdown/bold/italic/backticks/blockquote
//     .replace(/^\s*(?:[#\-\u2022>\s]*)?\d+[\.\)]\s*/, ""); // leading "1." / "1)" / bullets

//   // 3) Drop a prefixed court heading like:
//   //    "Supreme Court — ..." or "High Court of X — ..."
//   //    (handles em/en dashes, hyphen, or colon)
//   s = s.replace(/^(?:supreme\s+court|.*?high\s+court.*?)\s*(?:—|–|-|:)\s*/i, "");

//   // 4) Split on separators to inspect label segments
//   //    e.g. "file_name: R ..." -> ["file_name","R ..."]
//   //    e.g. "Court name: Madras High Court — Title: ABC" -> ["Court name","Madras High Court","Title","ABC"]
//   const segs = s.split(/\s*(?:—|–|-|:)\s*/).filter(Boolean);

//   // 5) If we see "title" or "file_name" labels, keep the segment after the last such label
//   let picked: string | null = null;
//   for (let i = 0; i < segs.length - 1; i++) {
//     const currentSeg = segs[i]; // Fix: Store in variable to avoid repeated indexing
//     const nextSeg = segs[i + 1];
    
//     if (currentSeg && nextSeg && /^(?:title|file[\s_-]*name)$/i.test(currentSeg)) {
//       picked = nextSeg;
//     }
//   }

//   // 6) If not found, but we have an HC line like "Court name: ... — Title: ...",
//   //    or any multi-segment line, prefer the last segment (most specific: the case title)
//   if (!picked && segs.length > 1) {
//     picked = segs[segs.length - 1] || null; // Fix: Add fallback for undefined
//   }

//   // 7) Fall back to s as-is if nothing picked
//   s = (picked || s).trim();

//   // 8) Normalize "Vs./V./v." variants to " v "
//   s = s.replace(/\bV(?:s\.?)?\b[\s\.]*/gi, " v ");

//   // 9) Remove junk punctuation that hurts matching (keep letters, digits, spaces, (), /, &, -)
//   // NOTE: avoid Unicode property escapes to keep TS targets happy
//   s = s.replace(/[^\w\s()/&-]/g, " ");

//   // 10) Collapse whitespace
//   s = s.replace(/\s+/g, " ").trim();

//   // 11) Empty/too-punctuated → empty string
//   if (!/[A-Za-z0-9]/.test(s)) return "";

//   return s;
// }  

//
// function normalizeSectionTitleInput(input: string): string {
//     let s = (input || "").trim();
    
//     // 1. Remove common copy-paste labels (e.g. "section title:", "title:", "section:")
//     // Matches "section title:", "section title -", "title : ", etc.
//     s = s.replace(/^(?:section\s*title|section|title)\s*(?:—|–|-|:)\s*/i, "");

//     // 2. Remove leading bullets or numbers (e.g. "1A.", "1.", ">")
//     s = s.replace(/^\s*(?:[#\-\u2022>\s]*)?[A-Za-z0-9]+\.?\s*/, "");

//     // 3. Collapse multiple spaces/newlines into a single space
//     // This ensures the backend receives "Word A Word B" instead of "Word A \n Word B"
//     s = s.replace(/\s+/g, " ").trim();
    
//     return s;
//   }

  // function normalizeJudgeNameInput(input: string): string {
  //   let s = (input || "").trim();

  //   // 1) Keep only the first line
  //   s = (s.split(/\r?\n/)[0] || "").trim();

  //   // 2) Strip markdown/bullets/quotes users might copy (e.g. "1.", "**")
  //   s = s.replace(/[*_`>]+/g, " ")
  //       .replace(/^\s*(?:[#\-\u2022>\s]*)?\d+[\.\)]\s*/, "");

  //   // 3) Strip common copy-paste label prefixes that the backend might NOT catch
  //   //    (The backend catches 'Hon'ble', 'Justice', etc., but not 'Coram' or 'Bench')
  //   s = s.replace(/^(?:judge|justice|coram|bench|before|present)\s*(?:—|–|-|:)\s*/i, "");

  //   // 4) Normalize commas
  //   s = s.replace(/\s*,\s*/g, ", ");

  //   // 5) Collapse whitespace
  //   s = s.replace(/\s+/g, " ").trim();

  //   // 6) Trim leading/trailing punctuation
  //   s = s.replace(/^(?:,|\s)+|(?:,|\s)+$/g, "");

  //   return s;
  // }
  //
  function makeQueryParams(baseQuery: string, pageSize: number): QueryParams {
    return {
      query: baseQuery,
      courts: selectedCourts,
      judge_name: judgeName.trim() || null,
      case_title: caseName.trim() || null,
      start_date: state[0]?.startDate ? format(state[0].startDate, "yyyy-MM-dd") : null,
      end_date: state[0]?.endDate ? format(state[0].endDate, "yyyy-MM-dd") : null,
      page_size: pageSize,
      keywords: [...keywords],
      keyword_logic: keywordLogic,
    };
  }  
  // Split base params into SC-only and HC-only for mixed advanced searches
  function splitMixedParams(base: QueryParams) {
    const hcList = highCourtsFrom(base.courts);
    const scSelected = base.courts.some((c) => c.trim().toLowerCase() === "supreme court");
    const scParams = scSelected ? { ...base, courts: ["Supreme Court"] } as QueryParams : null;
    const hcParams = hcList.length ? { ...base, courts: hcList } as QueryParams : null;
    return { scParams, hcParams };
  }

  // Fetch one page (safe: returns empty results array on any non-OK)
  async function fetchJudgementsPage(params: QueryParams, page: number) {
    try {
      const resp = await fetch("/api/legacysearch/judgements/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, page }),
      });
      if (!resp.ok) {
        return { results: [], total: 0, sc_total: 0, hc_total: 0, has_more: false };
      }
      const data = await resp.json();
      return data; // { results, total, sc_total, hc_total, has_more }
    } catch {
      return { results: [], total: 0, sc_total: 0, hc_total: 0, has_more: false };
    }
  }  
  // builds a friendly summary of whatever the user applied
  function buildAppliedSummary() {
    const parts: string[] = [];

    if (keywords.length) {
      parts.push(`Refined by keyword(s): ${keywords.join(", ")}`);
    }

    if (searchDomain === 'judgements') {
      if (judgeName.trim()) parts.push(`Judge: ${judgeName.trim()}`);
      if (caseName.trim()) parts.push(`Case title: ${caseName.trim()}`);

      const start = state[0]?.startDate;
      const end = state[0]?.endDate;
      if (start || end) {
        const s = start ? format(start, "PPP") : "—";
        const e = end ? format(end, "PPP") : "—";
        parts.push(`Date range: ${s} – ${e}`);
      }
      if (selectedCourts.length > 0) {
        parts.push(
          `Courts: ${selectedCourts.length > 3
            ? `${selectedCourts.slice(0, 3).join(", ")} +${selectedCourts.length - 3} more`
            : selectedCourts.join(", ")
          }`
        );
      }
    } else {
      if (sectionTitle.trim()) parts.push(`Search within Section Title: "${sectionTitle.trim()}"`);
      if (selectedStatutes.length) {
        parts.push(
          `Sources: ${selectedStatutes.length > 3
            ? `${selectedStatutes.slice(0, 3).join(", ")} +${selectedStatutes.length - 3} more`
            : selectedStatutes.join(", ")
          }`
        );
      }
    }

    return parts.join(" • ");
  } 
  //
  const clearAllConfigFields = () => {
    // refine
    setKeywords([]);
    setNewKeyword('');
    setKeywordLogic("OR");

    // advanced (judgements)
    setJudgeName('');
    setCaseName('');
    setState([{ startDate: null, endDate: null, key: 'selection' }]);
    setSelectedCourts([]);

    // advanced (statutes)
    setSectionTitle('');
    setSelectedStatutes([]);

    // local UI summaries / refine cache
    setRefineSnippetsByIndex({});
    setLastAppliedSummary('');
    setLastAppliedCtx(null);
    setLastAppliedStatutesCtx(null);

    toast.info("Refine search fields and advanced filters have been cleared.");
  };               
  //
  const applyConfiguration = async () => {
  let targetSessionId = getCurrentSessionId();
    
    // If we are on a new chat (no ID), create one immediately so we have somewhere to put the results
    if (!targetSessionId) {
       const projectId = params(SEARCH_PARAM_NAMES.PROJECT_ID);
       const searchParamBasedChatSessionName = searchParams?.get(SEARCH_PARAM_NAMES.TITLE) || null;
       
       targetSessionId = await createChatSession(
          liveAssistant?.id || 0,
          searchParamBasedChatSessionName,
          projectId ? parseInt(projectId) : null
       );
       
       // Update store and URL so the user stays on this new session
       updateStatesWithNewSessionId(targetSessionId);
       handleNewSessionNavigation(targetSessionId);
    }
  if (searchHistory.length === 0) {
        setPopup({
          type: "warning",
          message: "Please enter a search query first.",
        });
        return; 
      }        
    console.log("Applying configuration:", {
      keywords,
      judgeName,
      caseName,
      dateRange: state,
      selectedQueryId,
      selectedCourts,
    });

    let lastResponseMeta: LegacyMeta = {};
    setIsSearching(true);

    // persistent loader
    const toastId = toast.loading("Retrieving…");

    // validation
    const noKeywords = keywords.length === 0;

    if (searchDomain === 'statutes') {
      const noSectionTitle = !sectionTitle.trim();
      const noSources = selectedStatutes.length === 0;

      if (noKeywords && noSectionTitle && noSources) {
        setPopup({
          type: "warning",
          message:
            'Please add keywords, or use Statutes Advanced: "Search within Section Title", or select Central/State sources.',
        });
        setIsSearching(false);
        toast.dismiss(toastId);
        return;
      }
    } else {
      const noJudgeName = !judgeName.trim();
      const noCaseName = !caseName.trim();
      const noDateRange = !(state[0]?.startDate && state[0]?.endDate);
      const noCourts = selectedCourts.length === 0;

      if (noKeywords && noJudgeName && noCaseName && noDateRange && noCourts) {
        setPopup({
          type: "warning",
          message:
            'Please add keywords, or use one of the Advanced filters (judge, case title, date, or select court(s)).',
        });
        setIsSearching(false);
        toast.dismiss(toastId);
        return;
      }
    }

    if (searchDomain === 'statutes') {
      try {
        const selectedQuery = selectedQueryId
          ? searchHistory.find((q) => q.id === selectedQueryId) ?? null
          : null;
        const qid = selectedQuery ? selectedQuery.id : Date.now().toString();

        const PAGE_SIZE = 5;
        const baseParams: StatutesQueryParams = {
          query: (selectedQuery?.query === "(no query)" ? "" : selectedQuery?.query ?? ""),
          statutes: [...selectedStatutes],
          section_title: sectionTitle.trim() || null,
          page_size: PAGE_SIZE,
          keywords: [...keywords],
          keyword_logic: keywordLogic,
        };

        const useAdvanced = !!baseParams.section_title;
        const data = await fetchStatutesPage(baseParams, 1, useAdvanced);

        let pageResults: any[] = Array.isArray(data.results) ? data.results : [];

        // ===== strict refine on the page (AND + whole-word) =====
        // REMOVED: Client-side filtering is no longer needed because the backend 
        // now handles 'keywords' in the search query directly.
        
        // However, we still want to generate snippets for highlighting:
        let refineSnippetsMapStatutes: Record<number, { match_count: number; snippets: string[] }> = {};

        if (keywords.length > 0 && pageResults.length > 0) {
           try {
             const refineResponse = await fetch("/api/legacysearch/statutes/refine", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 results: pageResults,
                 keywords,
               }),
             });
             
             if (refineResponse.ok) {
                const { docs } = await refineResponse.json();
                docs.forEach((d: any, i: number) => {
                  refineSnippetsMapStatutes[i] = {
                    match_count: d.match_count,
                    snippets: d.snippets || [],
                  };
                });
             }
           } catch (e) {
             console.error("Statutes refine highlight error", e);
           }
        }
        
        setRefineSnippetsByIndex(refineSnippetsMapStatutes);

        // history
        const meta: LegacyMeta = {
          central_total: data.central_total,
          state_total: data.state_total,
          total: data.total,
          page: 1,
          page_size: PAGE_SIZE,
          has_more: data.has_more,
        };
        if (selectedQuery) {
          setSearchHistory((prev) =>
            prev.map((q) => (q.id === qid ? { ...q, results: pageResults, meta } : q))
          );
        } else {
          // create a history record if user applied over "(no query)"
          setSearchHistory((prev) => [
            ...prev,
            { id: qid, query: baseParams.query || "(no query)", results: pageResults, meta },
          ]);
          setSelectedQueryId(qid);
        }

        setPager((prev) => ({
          ...prev,
          [qid]: {
            domain: 'statutes',
            currentPage: 1,
            totalPages: Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE)),
            total: data.total ?? undefined,
            pageSize: PAGE_SIZE,
            hasMore: !!data.has_more,
            params: { ...baseParams },
            cache: { 1: [...pageResults] },
          },
        }));

        const baseLabel = selectedQuery?.query ?? "(no query)";
        const appliedRefine = keywords.length > 0;
        const appliedAdvanced = !!baseParams.section_title;

        let searchLabel = baseLabel;
        if (appliedRefine && appliedAdvanced) searchLabel += " / refined & advanced search (statutes)";
        else if (appliedRefine) searchLabel += " / refined search (statutes)";
        else if (appliedAdvanced) searchLabel += " / advanced search (statutes)";

        const header = headerLineStatutes(
          0,
          pageResults.length,
          data.total,
          data.central_total,
          data.state_total
        );
        const displayBody = renderRowsChunkStatutes(pageResults, 0);

        // Use the same pattern as onSubmit
        const { userMessage, assistantMessage } = createLegacySearchMessages(
          searchLabel,
          `${header}\n\n${displayBody}`,
        );

        upsertToCompleteMessageTree({
          messages: [userMessage, assistantMessage],
          chatSessionId: targetSessionId,
          makeLatestChildMessage: true,
        });

        const sessionId = targetSessionId;
        updateChatStateAction(sessionId, "input");
        updateRegenerationStateAction(sessionId, null);

        // user-facing “Applied …” summary (statutes)
        const parts: string[] = [];
        if (keywords.length) parts.push(`Refined by keyword(s): ${keywords.join(", ")}`);
        if (baseParams.section_title) parts.push(`Search within Section Title: "${baseParams.section_title}"`);
        if (selectedStatutes.length) {
          const cap = selectedStatutes.length > 3
            ? `${selectedStatutes.slice(0, 3).join(", ")} +${selectedStatutes.length - 3} more`
            : selectedStatutes.join(", ");
          parts.push(`Sources: ${cap}`);
        }
        const summary = parts.join(" • ");
        setLastAppliedSummary(summary);
        toast.success(summary || "Applied.", { id: toastId, duration: 4000 });

        setLastAppliedStatutesCtx({
          scope: deriveStatutesScopeFromSources(selectedStatutes),
          sources: [...selectedStatutes],
        });

        // keep popup open
      } catch (err) {
        console.error("Statutes Apply Error:", err);
        setPopup({ type: "error", message: "Statutes refine/advanced failed." });
        toast.error("Something went wrong while retrieving statutes.", { id: toastId, duration: 5000 });
      } finally {
        setIsSearching(false);
      }
      return;
    }

    try {
      // determine path
      const hasAdvanced =
        !!judgeName ||
        !!caseName ||
        (state[0]?.startDate && state[0]?.endDate) ||
        selectedCourts.length > 0;

      const selectedQuery = selectedQueryId
        ? searchHistory.find((q) => q.id === selectedQueryId) ?? null
        : null;

      let activeQueryId: string | null = selectedQuery?.id ?? selectedQueryId;

      let pageResults: any[] = [];
      const baseLabel = selectedQuery?.query ?? "(no query)";

      // ===== PATH A: local display (only if NO filters/keywords applied) =====
      // If we have keywords, we MUST go to Path B (server search).
      if (selectedQuery && !hasAdvanced && keywords.length === 0) {
        pageResults = [...selectedQuery.results];
        lastResponseMeta = selectedQuery.meta ?? {};

        // keep pager's keywords in sync for later "Show more"
        if (selectedQueryId && pager[selectedQueryId] && pager[selectedQueryId]!.domain === 'judgements') {
          setPager((prev) => {
            const cur = prev[selectedQueryId] as JudgementsPagerEntry;
            return {
              ...prev,
              [selectedQueryId]: {
                ...cur,
                params: { ...cur.params, keywords: [...keywords] },
              },
            };
          });
        }

        // ===== PATH B: advanced OR refine keywords → call backend page 1 =====
      } else {
        const PAGE_SIZE = 5;
        const baseParams = makeQueryParams((selectedQuery?.query === "(no query)" ? "" : selectedQuery?.query ?? ""), PAGE_SIZE);

        // Detect the problematic combo: SC + any HC + (judge_name || case_title || date range)
        const mixedAdvanced =
          bothCourtsSelected(baseParams.courts) &&
          (!!baseParams.judge_name || !!baseParams.case_title || (!!baseParams.start_date && !!baseParams.end_date));

        const qid = selectedQuery ? selectedQuery.id : Date.now().toString();

        if (mixedAdvanced) {
          // --- Split path: fetch SC-only and HC-only, then merge the first page ---
          const { scParams, hcParams } = splitMixedParams(baseParams);

          const [scData, hcData] = await Promise.all([
            scParams ? fetchJudgementsPage(scParams, 1) : Promise.resolve({ results: [], total: 0 }),
            hcParams ? fetchJudgementsPage(hcParams, 1) : Promise.resolve({ results: [], total: 0 }),
          ]);

          const scTotal = Number(scData.total || 0);
          const hcTotal = Number(hcData.total || 0);
          const grandTotal = scTotal + hcTotal;

          // Build combined first page (SC first, then HC) capped to PAGE_SIZE
          const combinedFirst = [
            ...(Array.isArray(scData.results) ? scData.results : []),
            ...(Array.isArray(hcData.results) ? hcData.results : []),
          ].slice(0, PAGE_SIZE);

          pageResults = combinedFirst;
          lastResponseMeta = {
            sc_total: scTotal,
            hc_total: hcTotal,
            total: grandTotal,
            page: 1,
            page_size: PAGE_SIZE,
            has_more: grandTotal > PAGE_SIZE,
          };

          // Upsert history record
          if (selectedQuery) {
            setSearchHistory((prev) =>
              prev.map((q) => (q.id === qid ? { ...q, results: pageResults, meta: lastResponseMeta } : q))
            );
          } else {
            setSearchHistory((prev) => [...prev, { id: qid, query: baseLabel, results: pageResults, meta: lastResponseMeta }]);
            setSelectedQueryId(qid);
          }

          setPager((prev) => ({
            ...prev,
            [qid]: {
              domain: 'judgements',
              currentPage: 1,
              totalPages: Math.max(1, Math.ceil(grandTotal / PAGE_SIZE)),
              total: grandTotal,
              pageSize: PAGE_SIZE,
              hasMore: grandTotal > PAGE_SIZE,
              params: { ...baseParams, keywords: [...keywords] },
              cache: { 1: [...pageResults] },
              mixedSplit: {
                sc: scParams ? { total: scTotal, params: scParams, cache: { 1: Array.isArray(scData.results) ? [...scData.results] : [] } } : undefined,
                hc: hcParams ? { total: hcTotal, params: hcParams, cache: { 1: Array.isArray(hcData.results) ? [...hcData.results] : [] } } : undefined,
              },
            },
          }));

        } else {
          // --- Original single-call path (SC-only or HC-only or mixed without advanced fields) ---
          const advancedResponse = await fetch("/api/legacysearch/judgements/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...baseParams, page: 1 }),
          });
          if (!advancedResponse.ok) throw new Error("Advanced search failed");

          const adv = await advancedResponse.json(); // { results, total, sc_total, hc_total, page, page_size, has_more }
          if (adv.benchmarks) {
            console.groupCollapsed(`Legacy Search Benchmarks (Advanced) - ${adv.total} results`);
            console.table(adv.benchmarks);
            console.groupEnd();
          }          
          pageResults = adv.results;
          lastResponseMeta = {
            sc_total: adv.sc_total,
            hc_total: adv.hc_total,
            total: adv.total,
            page: 1,
            page_size: PAGE_SIZE,
            has_more: adv.has_more,
          };

          if (selectedQuery) {
            setSearchHistory((prev) =>
              prev.map((q) => (q.id === qid ? { ...q, results: pageResults, meta: lastResponseMeta } : q))
            );
          } else {
            setSearchHistory((prev) => [...prev, { id: qid, query: baseLabel, results: pageResults, meta: lastResponseMeta }]);
            setSelectedQueryId(qid);
          }

          setPager((prev) => ({
            ...prev,
            [qid]: {
              domain: 'judgements',
              currentPage: 1,
              totalPages: Math.max(1, Math.ceil((adv.total ?? 0) / PAGE_SIZE)),
              total: adv.total ?? undefined,
              pageSize: PAGE_SIZE,
              hasMore: !!adv.has_more,
              params: { ...baseParams, keywords: [...keywords] },
              cache: { 1: [...pageResults] },
            },
          }));
        }
      }

      // ===== refine/highlight (applies to BOTH paths) =====
      // We only fetch snippets for highlighting. The DB has already filtered the results.
      let refineSnippetsMap: Record<number, { match_count: number; snippets: string[] }> = {};

      if (keywords.length > 0 && pageResults.length > 0) {
        const refineResponse = await fetch("/api/legacysearch/judgements/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            results: pageResults,
            keywords,
            max_snippets_per_doc: 3,
            snippet_window: 120,
          }),
        });

        if (refineResponse.ok) {
          const { docs } = await refineResponse.json();
          docs.forEach((d: any, i: number) => {
            // Just map snippets for display. Do NOT remove items from pageResults.
            refineSnippetsMap[i] = {
              match_count: d.match_count,
              snippets: d.snippets || [],
            };
          });
        }
        // Do NOT overwrite pageResults with filteredResults anymore.
      }
      setRefineSnippetsByIndex(refineSnippetsMap);
      // Keep history in sync with the actually displayed (possibly refined) page results
      if (activeQueryId) {
        setSearchHistory((prev) =>
          prev.map((q) =>
            q.id === activeQueryId
              ? { ...q, results: [...pageResults], meta: q.meta ?? lastResponseMeta }
              : q
          )
        );
      }

      // empty after refine → emit empty state & stop
      if (keywords.length > 0 && pageResults.length === 0) {
      // Use the same pattern as onSubmit
      const { userMessage, assistantMessage } = createLegacySearchMessages(
        `${baseLabel} / refined search`,
        `No results matched your keyword(s): **${keywords.join(", ")}**.`,
      );

      upsertToCompleteMessageTree({
        messages: [userMessage, assistantMessage],
        chatSessionId: targetSessionId,
        makeLatestChildMessage: true,
      });

        const sessionId = targetSessionId;
        updateChatStateAction(sessionId, "input");
        updateRegenerationStateAction(sessionId, null);
        setIsSearching(false);
        toast(`No results matched your keyword(s): ${keywords.join(", ")}`, {
          id: toastId,
          icon: "ℹ️",
          duration: 4000,
        });
        return;
      }

      // ===== build & emit message (works for BOTH paths) =====
      const appliedRefine = keywords.length > 0;
      const appliedAdvanced = hasAdvanced;

      let searchLabel = baseLabel;
      if (appliedRefine && appliedAdvanced) searchLabel += " / refined & advanced search";
      else if (appliedRefine) searchLabel += " / refined search";
      else if (appliedAdvanced) searchLabel += " / advanced search";

      let displayResults = [...pageResults];

      // if (searchDomain === 'judgements' && bothCourtsSelected(selectedCourts)) {
      //   const hasSC = displayResults.some((r) => r.source === "SC");
      //   const hasHC = displayResults.some((r) => r.source === "HC");
      //   const scTotal = lastResponseMeta.sc_total ?? 0;
      //   const hcTotal = lastResponseMeta.hc_total ?? 0;
      //   if (!hasSC && scTotal === 0) displayResults.unshift(buildEmptySCRow());
      //   if (!hasHC && hcTotal === 0) displayResults.push(buildEmptyHCRow(highCourtsFrom(selectedCourts)));
      // }

      const header = headerLine(
        0,
        pageResults.length,
        lastResponseMeta.total,
        searchDomain === 'judgements' ? lastResponseMeta.sc_total : undefined,
        searchDomain === 'judgements' ? lastResponseMeta.hc_total : undefined
      );

      // --- ADDED: Extract snippets to pass to renderer ---
      const simpleSnippetsMap: Record<number, string[]> = {};
      Object.keys(refineSnippetsMap).forEach((k: any) => {
        // FIX: Add ?. and || [] fallback
        simpleSnippetsMap[k] = refineSnippetsMap[k]?.snippets || []; 
      });

      // Pass simpleSnippetsMap as the 3rd argument
      const displayBody = renderRowsChunk(displayResults, 0, simpleSnippetsMap);

      // Use the same pattern as onSubmit
      const { userMessage, assistantMessage } = createLegacySearchMessages(
        searchLabel,
        `${header}\n\n${displayBody}`,
      );

      // Use the existing upsertToCompleteMessageTree function
      upsertToCompleteMessageTree({
        messages: [userMessage, assistantMessage],
        chatSessionId: targetSessionId,
        makeLatestChildMessage: true,
      });

      // Use the store actions directly
      const sessionId = targetSessionId;
      updateChatStateAction(sessionId, "input");
      updateRegenerationStateAction(sessionId, null);

      const summary = buildAppliedSummary();
      setLastAppliedSummary(summary);
      toast.success(summary || "Applied.", { id: toastId, duration: 4000 });

      setLastAppliedCtx({
        scope: deriveScopeFromCourts(selectedCourts),
        courts: [...selectedCourts],
      });
      // keep popup open

      } catch (error) {
        console.error("Refine/Advanced Error:", error);
        const sessionId = targetSessionId;
        updateChatStateAction(sessionId, "input");
        setPopup({ type: "error", message: "Search refine/advanced failed." });
        toast.error("Something went wrong while retrieving results.", {
          id: toastId,
          duration: 5000,
        });
      }finally {
      setIsSearching(false);
    }
  };
  //
  async function goToPage(queryId: string, page: number) {
    const entry = pager[queryId];
    if (!entry || entry.domain !== 'judgements') {
      toast.info('Paging applies to Judgments. Use "Show more" in Statutes.');
      return;
    }
    const jEntry = entry; // JudgementsPagerEntry

    if (page < 1 || page > jEntry.totalPages) return;
    if (page === jEntry.currentPage && jEntry.cache?.[page]) return; // already on it

    // ─────────────────────────────────────────────────────────────
    // INSERT START: MIXED SPLIT PAGINATION (SC first, then HC)
    // This short-circuits the normal path whenever mixedSplit is present.
    if (entry.mixedSplit) {
      try {
        setLoadingPageFor(`${queryId}:${page}`);

        // 1) Use combined cache if available
        const cachedCombined = entry.cache?.[page];
        let newPageResults: any[] = Array.isArray(cachedCombined) ? [...cachedCombined] : [];

        if (newPageResults.length === 0) {
          // 2) Assemble from per-source caches (fetching missing pages as needed)
          const { rows, totals } = await assembleMixedPage(entry, page);
          newPageResults = rows;

          // 3) Cache the combined page
          setPager((prev) => {
            const existing = prev[queryId];
            if (!existing) return prev;
            
            return {
              ...prev,
              [queryId]: {
                ...existing,
                cache: { ...(existing.cache || {}), [page]: [...newPageResults] },
              } as JudgementsPagerEntry | StatutesPagerEntry,
            };
          });

          // 4) Update totals snapshot for this page
          setSearchHistory((prev) =>
            prev.map((q) =>
              q.id === queryId
                ? {
                  ...q,
                  results: [...newPageResults],
                  meta: {
                    sc_total: totals.sc_total,
                    hc_total: totals.hc_total,
                    total: totals.total,
                    page,
                    page_size: entry.pageSize,
                    has_more: page < entry.totalPages,
                  },
                }
                : q
            )
          );
        } else {
          // keep meta coherent when serving from combined cache
          const scT = entry.mixedSplit.sc?.total ?? 0;
          const hcT = entry.mixedSplit.hc?.total ?? 0;
          const tot = scT + hcT;
          setSearchHistory((prev) =>
            prev.map((q) =>
              q.id === queryId
                ? {
                  ...q,
                  results: [...newPageResults],
                  meta: {
                    sc_total: scT,
                    hc_total: hcT,
                    total: tot,
                    page,
                    page_size: entry.pageSize,
                    has_more: page < entry.totalPages,
                  },
                }
                : q
            )
          );
        }

        // 6) Update pager current page
        setPager((prev) => {
          const existing = prev[queryId];
          if (!existing) return prev;
          
          return {
            ...prev,
            [queryId]: {
              ...existing,
              currentPage: page,
              hasMore: page < existing.totalPages,
            } as JudgementsPagerEntry | StatutesPagerEntry,
          };
        });

// 7) Emit UI message (same presentation as your normal path)
        // KEEP THESE DEFINITIONS so headerLine works!
        const scTotal = entry.mixedSplit.sc?.total ?? 0;
        const hcTotal = entry.mixedSplit.hc?.total ?? 0;
        const totalsAll = scTotal + hcTotal;

        const newMessageId = Date.now();

        const startIndex = (page - 1) * entry.pageSize;
        const header = headerLine(startIndex, newPageResults.length, totalsAll, scTotal, hcTotal);

        let displayResults = [...newPageResults];

    // --- ADDED: Prepare snippets map for this page ---
          // We look at the 'newMap' you created inside the 'if (!usedCache)' block above,
          // OR we look at 'refineSnippetsByIndex' if it was already in state.
          // Since 'refineSnippetsByIndex' might not be updated yet (React state is async),
          // we need to rely on the logic that fetched the highlights.
          
          const simpleSnippetsMap: Record<number, string[]> = {};
          
          // If we just fetched new snippets (see the 'refineResp' block above in your code),
          // we need to make sure we use them. 
          // Note: In your current code, you create 'newMap' inside the `if (!usedCache)` block.
          // To make this robust, let's grab the current state and merge/override if we just fetched.
          
          // 1. If we have cached snippets in state, use them
          Object.keys(refineSnippetsByIndex).forEach((k: any) => {
            // FIX: Add ?. and || [] fallback
            simpleSnippetsMap[k] = refineSnippetsByIndex[k]?.snippets || [];
          });

          // Pass simpleSnippetsMap as the 3rd argument
          const body = renderRowsChunk(displayResults, startIndex, simpleSnippetsMap);

          // Create messages using the same pattern as in applyConfiguration
          const { userMessage, assistantMessage } = createLegacySearchMessages(
          `Go to page ${page}`,
          `${header}\n\n${body}`
        );

      upsertToCompleteMessageTree({
        messages: [userMessage, assistantMessage],
        chatSessionId: getCurrentSessionId(), // Use getCurrentSessionId() instead of currentSessionId()
        makeLatestChildMessage: true,
      });

      updateChatStateAction(getCurrentSessionId(), "input");
      resetRegenerationState(getCurrentSessionId());
      } catch (e) {
        console.error("Paging error (mixed):", e);
        toast.error("Could not load that page. Please try again.");
      } finally {
        setLoadingPageFor(null);
      }
      return; // IMPORTANT: don't fall through to the normal path
    }
    try {
      setLoadingPageFor(`${queryId}:${page}`);

      // 1) Use cache if we have it
      const cached = entry.cache?.[page];
      let newPageResults: any[] = Array.isArray(cached) ? [...cached] : [];
      const usedCache = Array.isArray(cached);
      let totals = {
        total: entry.total,
        sc_total: searchDomain === 'judgements' ? searchHistory.find(q => q.id === queryId)?.meta?.sc_total : undefined,
        hc_total: searchDomain === 'judgements' ? searchHistory.find(q => q.id === queryId)?.meta?.hc_total : undefined,
      };

      // 2) Fetch if not cached
      if (!usedCache) {
        const resp = await fetch("/api/legacysearch/judgements/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...entry.params,
            page,
          }),
        });
        if (!resp.ok) throw new Error("Paging failed");
        const data = await resp.json(); // { results, total, sc_total, hc_total, has_more }
        if (data.benchmarks) {
           console.groupCollapsed(`Legacy Search Benchmarks (Page ${page})`);
           console.table(data.benchmarks);
           console.groupEnd();
        }        
        newPageResults = Array.isArray(data.results) ? data.results : [];

        // Fetch highlights for the new page if keywords exist
        if (entry.params.keywords.length > 0 && newPageResults.length > 0) {
           try {
             const refineResp = await fetch("/api/legacysearch/judgements/refine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  results: newPageResults,
                  keywords: entry.params.keywords,
                  max_snippets_per_doc: 3,
                  snippet_window: 120,
                }),
             });
             if (refineResp.ok) {
               const { docs } = await refineResp.json();
               // We need to MERGE these into the existing refineSnippetsByIndex
               // or handle them. Since paging replaces the view, we usually just set them.
               // However, `goToPage` updates history, so the main view might re-render.
               // Ideally, we update the snippet state here:
               const newMap: Record<number, { match_count: number; snippets: string[] }> = {};
               docs.forEach((d: any, i: number) => {
                 newMap[i] = { match_count: d.match_count, snippets: d.snippets || [] };
               });
               setRefineSnippetsByIndex(newMap);
             }
           } catch (e) {
             console.error("Refine highlight error on page change", e);
           }
        }

        totals = {
          total: data.total,
          sc_total: data.sc_total,
          hc_total: data.hc_total,
        };

      // update cache for this page
      setPager((prev) => {
        const existing = prev[queryId];
        if (!existing) return prev;
        
        return {
          ...prev,
          [queryId]: {
            ...existing,
            cache: { ...(existing.cache || {}), [page]: [...newPageResults] },
          } as JudgementsPagerEntry | StatutesPagerEntry,
        };
      });
      }

      // 3) Replace results in history with *this page only*
      setSearchHistory((prev) =>
        prev.map((q) =>
          q.id === queryId
            ? {
              ...q,
              results: [...newPageResults],
              meta: {
                sc_total: totals.sc_total,
                hc_total: totals.hc_total,
                total: totals.total,
                page,
                page_size: entry.pageSize,
                has_more: page < entry.totalPages,
              },
            }
            : q
        )
      );

      // 4) Update pager current page
      setPager((prev) => {
        const existing = prev[queryId];
        if (!existing) return prev;
        
        return {
          ...prev,
          [queryId]: {
            ...existing,
            currentPage: page,
            hasMore: page < existing.totalPages,
          } as JudgementsPagerEntry | StatutesPagerEntry,
        };
      });

      // 5) Emit the page chunk as a new assistant message
      const newMessageId = Date.now();

      const startIndex = (page - 1) * entry.pageSize;
      const header = headerLine(
        startIndex,
        newPageResults.length,
        totals.total,
        totals.sc_total,
        totals.hc_total
      );

    // FIX: Just use newPageResults directly. Deleted the logic that injects empty rows.
      let displayResults = [...newPageResults];

      // --- FIX STARTS HERE ---
      const simpleSnippetsMap: Record<number, string[]> = {};
      // Use the snippets we just put into state (or check ref if state update is too slow, but usually state object ref is stable enough here)
      // Ideally, pass the `newMap` you created earlier.
      // Assuming you defined 'newMap' inside the if block, we can't access it here.
      // RECOMMENDATION: Just rely on refineSnippetsByIndex, but since state updates are slow,
      // the immediate render might miss it.
      
      // To fix this properly, scroll up to where you define `const newMap = ...` inside `if (!usedCache)`.
      // Define `let currentSnippets = {}` at the start of `goToPage` function.
      // Inside `if (refineResp.ok)`, set `currentSnippets = newMap`.
      // Then use `currentSnippets` here.
      
      // For now, assuming you updated the state, we try to use it:
      Object.keys(refineSnippetsByIndex).forEach((k: any) => {
         // FIX: Add ?. and || [] fallback
         simpleSnippetsMap[k] = refineSnippetsByIndex[k]?.snippets || [];
      });

      const body = renderRowsChunk(displayResults, startIndex, simpleSnippetsMap);

      // Create messages using the same pattern as in applyConfiguration
      const { userMessage, assistantMessage } = createLegacySearchMessages(
        `Go to page ${page}`,
        `${header}\n\n${body}`
      );

      upsertToCompleteMessageTree({
        messages: [userMessage, assistantMessage],
        chatSessionId: getCurrentSessionId(),
        makeLatestChildMessage: true,
      });

      updateChatStateAction(getCurrentSessionId(), "input");
      resetRegenerationState(getCurrentSessionId());
    } catch (e) {
      console.error("Paging error:", e);
      toast.error("Could not load that page. Please try again.");
    } finally {
      setLoadingPageFor(null);
    }
  }
  //
  async function goToPageStatutes(queryId: string, page: number) {
    const entry = pager[queryId];
    if (!entry || entry.domain !== 'statutes') return;
    const sEntry = entry; // StatutesPagerEntry

    if (page < 1 || page > sEntry.totalPages) return;
    if (page === sEntry.currentPage && sEntry.cache?.[page]) return; // already on it

    try {
      setLoadingPageFor(`${queryId}:${page}`);

      // 1) Use cache if present
      const cached = sEntry.cache?.[page];
      let newPageResults: any[] = Array.isArray(cached) ? [...cached] : [];
      const usedCache = Array.isArray(cached);

      // We’ll keep these to render header
      let totals = {
        total: sEntry.total,
        central_total: searchHistory.find(q => q.id === queryId)?.meta?.central_total,
        state_total: searchHistory.find(q => q.id === queryId)?.meta?.state_total,
      };

      // 2) Fetch if not cached
      if (!usedCache) {
        const params = sEntry.params; // StatutesQueryParams
        const useAdvanced = !!params.section_title;
        const resp = await fetchStatutesPage(params, page, useAdvanced);

        newPageResults = Array.isArray(resp.results) ? resp.results : [];

        // NEW: Fetch highlights for the new page (consistent with Judgements)
        if ((params.keywords?.length || 0) > 0 && newPageResults.length > 0) {
           try {
             const refineResp = await fetch("/api/legacysearch/statutes/refine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  results: newPageResults,
                  keywords: params.keywords,
                }),
             });
             if (refineResp.ok) {
               const { docs } = await refineResp.json();
               
               // Merge these new snippets into the existing map
               // Note: For statutes (infinite scroll usually), we might want to APPEND to the map.
               // But since the map key is 'index on page', and we render chunks, 
               // we usually just update the state.
               // However, since Statutes often renders a long list, ensure your rendering logic 
               // knows how to look up snippets for page > 1. 
               
               // Ideally, just set them to state:
               const newMap: Record<number, { match_count: number; snippets: string[] }> = {};
               docs.forEach((d: any, i: number) => {
                 // Adjust index if your UI relies on absolute indexing, 
                 // otherwise keep it relative to the page chunk.
                 newMap[i] = { match_count: d.match_count, snippets: d.snippets || [] };
               });
               
               // For Statutes (which might be appending), you might want to merge:
               // setRefineSnippetsByIndex(prev => ({ ...prev, ...newMap }));
               // But for now, simple setting is consistent with your current logic.
               setRefineSnippetsByIndex(newMap);
             }
           } catch (e) {
             console.error("Refine highlight error on statutes page change", e);
           }
        }

        totals = {
          total: resp.total,
          central_total: resp.central_total,
          state_total: resp.state_total,
        };

        // cache page
        setPager(prev => {
          const existing = prev[queryId];
          if (!existing) return prev;
          
          return {
            ...prev,
            [queryId]: {
              ...existing,
              cache: { ...(existing.cache || {}), [page]: [...newPageResults] },
            } as JudgementsPagerEntry | StatutesPagerEntry,
          };
        });
      }

      // 3) Replace results in history with *this page only*
      setSearchHistory(prev =>
        prev.map(q =>
          q.id === queryId
            ? {
              ...q,
              results: [...newPageResults],
              meta: {
                central_total: totals.central_total,
                state_total: totals.state_total,
                total: totals.total,
                page,
                page_size: sEntry.pageSize,
                has_more: page < sEntry.totalPages,
              },
            }
            : q
        )
      );

      // 4) Update pager current page
      setPager(prev => {
        const existing = prev[queryId];
        if (!existing) return prev;
        
        return {
          ...prev,
          [queryId]: {
            ...existing,
            currentPage: page,
            hasMore: page < existing.totalPages,
          } as JudgementsPagerEntry | StatutesPagerEntry,
        };
      });

      // 5) Emit the page chunk (mirrors judgements)
      const newMessageId = Date.now();

      const startIndex = (page - 1) * sEntry.pageSize;
      const header = headerLineStatutes(
        startIndex,
        newPageResults.length,
        totals.total,
        totals.central_total,
        totals.state_total
      );
      const simpleSnippetsMap: Record<number, string[]> = {};
      Object.keys(refineSnippetsByIndex).forEach((k: any) => {
         // FIX: Add ?. and || [] fallback
         simpleSnippetsMap[k] = refineSnippetsByIndex[k]?.snippets || [];
      });

      const body = renderRowsChunkStatutes(newPageResults, startIndex, simpleSnippetsMap);

      // Create messages using the same pattern as in applyConfiguration
      const { userMessage, assistantMessage } = createLegacySearchMessages(
        `Go to page ${page}`,
        `${header}\n\n${body}`
      );

      upsertToCompleteMessageTree({
        messages: [userMessage, assistantMessage],
        chatSessionId: getCurrentSessionId(),
        makeLatestChildMessage: true,
      });

      updateChatStateAction(getCurrentSessionId(), "input");
      resetRegenerationState(getCurrentSessionId());
    } catch (e) {
      console.error("Paging error (statutes):", e);
      toast.error("Could not load that page. Please try again.");
    } finally {
      setLoadingPageFor(null);
    }
  }
  //
  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;

    if (keywords.includes(trimmed)) {
      toast.warning(`"${trimmed}" is already added.`);
      return;
    }

    setKeywords(prev => [...prev, trimmed]);
    setNewKeyword('');
  };
  //
  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };
                    
  // Legacy Search End //          

  // Use custom hooks for accessing store data
  const currentMessageTree = useCurrentMessageTree();
  const currentMessageHistory = useCurrentMessageHistory();
  const currentChatState = useCurrentChatState();

  const navigatingAway = useRef(false);

  // Local state that doesn't need to be in the store
  const [_maxTokens, setMaxTokens] = useState<number>(4096);

  // Sync store state changes
  useEffect(() => {
    if (currentSessionId) {
      // Keep track of current session ID for internal use
    }
  }, [currentSessionId]);

  const getCurrentSessionId = (): string => {
    return currentSessionId || existingChatSessionId || "";
  };

  const updateRegenerationState = (
    newState: RegenerationState | null,
    sessionId?: string | null
  ) => {
    const targetSessionId = sessionId || getCurrentSessionId();
    if (targetSessionId) {
      updateRegenerationStateAction(targetSessionId, newState);
    }
  };

  const resetRegenerationState = (sessionId?: string | null) => {
    updateRegenerationState(null, sessionId);
  };

  const updateCanContinue = (newState: boolean, sessionId?: string | null) => {
    const targetSessionId = sessionId || getCurrentSessionId();
    if (targetSessionId) {
      updateCanContinueAction(targetSessionId, newState);
    }
  };

  const updateStatesWithNewSessionId = (newSessionId: string) => {
    // Create new session in store if it doesn't exist
    const existingSession = sessions.get(newSessionId);
    if (!existingSession) {
      createSession(newSessionId);
    }

    // Set as current session
    setCurrentSession(newSessionId);
  };

  const handleNewSessionNavigation = (chatSessionId: string) => {
    // Build URL with skip-reload parameter
    const newUrl = buildChatUrl(
      searchParams,
      chatSessionId,
      null,
      false,
      true // skipReload
    );

    // Navigate immediately if still on chat page
    if (pathname === "/chat" && !navigatingAway.current) {
      router.push(newUrl, { scroll: false });
    }

    // Refresh sidebar so chat appears (will show as "New Chat" initially)
    // Will be updated again after naming completes
    refreshChatSessions();
    fetchProjects();
  };

const handleNewSessionNaming = async (chatSessionId: string) => {
  // Wait 200ms before naming (gives backend time to process)
  // There is some delay here since we might get a "finished" response from the backend
  // before the ChatSession is written to the database.
  // TODO: remove this delay once we have a way to know when the ChatSession
  // is written to the database.
  await new Promise((resolve) => setTimeout(resolve, 200));

  try {

    // // Special-case: rename for Case Analysis assistant
    // const isCaseAnalysis =
    //   liveAssistant?.name === "Case Analysis" ||
    //   liveAssistant?.id === ASSISTANT_ID_CASE_ANALYSIS;

    // if (isCaseAnalysis) {
    //   const response = await fetch("/api/chat/rename-chat-session", {
    //     method: "PUT",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       chat_session_id: chatSessionId,
    //       name: "Case Analysis Chat",
    //     }),
    //   });
    //   if (!response.ok) {
    //     console.error("Failed to rename Case Analysis chat");
    //   }
    //   return;
    // }

    // ADD THIS BLOCK FOR LEGACY SEARCH
    // Special-case: rename for Legacy Search assistant
    const isLegacySearch =
      liveAssistant?.name === "Legacy Search" ||
      liveAssistant?.id === ASSISTANT_ID_LEGACY_SEARCH;

    if (isLegacySearch) {
      const response = await fetch("/api/chat/rename-chat-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_session_id: chatSessionId,
          name: "Legacy Search Chat",
        }),
      });
      if (!response.ok) {
        console.error("Failed to rename Legacy Search chat");
      }
      return;
    }

    // Name chat based on AI response
    const response = await nameChatSession(chatSessionId);

    if (!response.ok) {
      console.error("Failed to name chat session, status:", response.status);
      // Still refresh to show the unnamed chat in sidebar
      refreshChatSessions();
      fetchProjects();
      return;
    }
  } catch (error) {
    console.error("Failed to name chat session:", error);
  } finally {
    // Refresh sidebar to show new name
    await refreshChatSessions();
    await fetchProjects();
  }
};

  const upsertToCompleteMessageTree = ({
    messages,
    completeMessageTreeOverride,
    chatSessionId,
    makeLatestChildMessage = false,
  }: {
    messages: Message[];
    // if calling this function repeatedly with short delay, stay may not update in time
    // and result in weird behavipr
    completeMessageTreeOverride?: MessageTreeState | null;
    chatSessionId?: string;
    oldIds?: number[] | null;
    makeLatestChildMessage?: boolean;
  }) => {
    let currentMessageTreeToUse =
      completeMessageTreeOverride ||
      (chatSessionId !== undefined &&
        sessions.get(chatSessionId)?.messageTree) ||
      currentMessageTree ||
      new Map<number, Message>();

    const newCompleteMessageTree = upsertMessages(
      currentMessageTreeToUse,
      messages,
      makeLatestChildMessage
    );

    const sessionId = chatSessionId || getCurrentSessionId();
    updateSessionMessageTree(sessionId, newCompleteMessageTree);

    return {
      sessionId,
      messageTree: newCompleteMessageTree,
    };
  };

  const stopGenerating = useCallback(async () => {
    const currentSession = getCurrentSessionId();
    const lastMessage = currentMessageHistory[currentMessageHistory.length - 1];

    // Check if the current message uses agent search (any non-null research type)
    const isDeepResearch = lastMessage?.researchType === ResearchType.Deep;
    const isSimpleAgentFrameworkDisabled =
      posthog.isFeatureEnabled("disable-simple-agent-framework") ?? false;

    // Always call the backend stop endpoint unless feature flag is enabled to disable it
    if (!isSimpleAgentFrameworkDisabled) {
      try {
        await stopChatSession(currentSession);
      } catch (error) {
        console.error("Failed to stop chat session:", error);
        // Continue with UI cleanup even if backend call fails
      }
    }

    // Only do the subsequent cleanup if the message was agent search or feature flag is enabled to disable it
    if (isDeepResearch || isSimpleAgentFrameworkDisabled) {
      abortSession(currentSession);

      if (
        lastMessage &&
        lastMessage.type === "assistant" &&
        lastMessage.toolCall &&
        lastMessage.toolCall.tool_result === undefined
      ) {
        const newMessageTree = new Map(currentMessageTree);
        const updatedMessage = { ...lastMessage, toolCall: null };
        newMessageTree.set(lastMessage.nodeId, updatedMessage);
        updateSessionMessageTree(currentSession, newMessageTree);
      }

      // Ensure UI reflects a STOP event by appending a STOP packet to the
      // currently streaming assistant message if one exists and doesn't already
      // contain a STOP. This makes AIMessage behave as if a STOP packet arrived.
      if (lastMessage && lastMessage.type === "assistant") {
        const packets = lastMessage.packets || [];
        const hasStop = packets.some((p) => p.obj.type === PacketType.STOP);
        if (!hasStop) {
          const maxInd =
            packets.length > 0 ? Math.max(...packets.map((p) => p.ind)) : 0;
          const stopPacket: Packet = {
            ind: maxInd + 1,
            obj: { type: PacketType.STOP },
          } as Packet;

          const newMessageTree = new Map(currentMessageTree);
          const updatedMessage = {
            ...lastMessage,
            packets: [...packets, stopPacket],
          } as Message;
          newMessageTree.set(lastMessage.nodeId, updatedMessage);
          updateSessionMessageTree(currentSession, newMessageTree);
        }
      }
    }

  // setCaseAnalysisConfidence(null);
  // setCaseAnalysisReasoning(null);
  // setHasCaseAnalysisStarted(false);

    updateChatStateAction(currentSession, "input");
  }, [currentMessageHistory, currentMessageTree, posthog]);

  const onSubmit = useCallback(
    async ({
      message,
      currentMessageFiles,
      useAgentSearch,
      messageIdToResend,
      queryOverride,
      forceSearch,
      isSeededChat,
      modelOverride,
      regenerationRequest,
      overrideFileDescriptors,
    }: OnSubmitProps) => {
      const projectId = params(SEARCH_PARAM_NAMES.PROJECT_ID);
      {
        const params = new URLSearchParams(searchParams?.toString() || "");
        if (params.has(SEARCH_PARAM_NAMES.PROJECT_ID)) {
          params.delete(SEARCH_PARAM_NAMES.PROJECT_ID);
          const newUrl = params.toString()
            ? `${pathname}?${params.toString()}`
            : pathname;
          router.replace(newUrl, { scroll: false });
        }
      }

      updateSubmittedMessage(getCurrentSessionId(), message);

      navigatingAway.current = false;
      let frozenSessionId = getCurrentSessionId();
      updateCanContinue(false, frozenSessionId);
      setUncaughtError(frozenSessionId, null);
      setLoadingError(frozenSessionId, null);

      // Check if the last message was an error and remove it before proceeding with a new message
      // Ensure this isn't a regeneration or resend, as those operations should preserve the history leading up to the point of regeneration/resend.
      let currentMessageTreeLocal =
        currentMessageTree || new Map<number, Message>();
      let currentHistory = getLatestMessageChain(currentMessageTreeLocal);
      let lastMessage = currentHistory[currentHistory.length - 1];

      if (
        lastMessage &&
        lastMessage.type === "error" &&
        !messageIdToResend &&
        !regenerationRequest
      ) {
        const newMessageTree = new Map(currentMessageTreeLocal);
        const parentNodeId = lastMessage.parentNodeId;

        // Remove the error message itself
        newMessageTree.delete(lastMessage.nodeId);

        // Remove the parent message + update the parent of the parent to no longer
        // link to the parent
        if (parentNodeId !== null && parentNodeId !== undefined) {
          const parentOfError = newMessageTree.get(parentNodeId);
          if (parentOfError) {
            const grandparentNodeId = parentOfError.parentNodeId;
            if (grandparentNodeId !== null && grandparentNodeId !== undefined) {
              const grandparent = newMessageTree.get(grandparentNodeId);
              if (grandparent) {
                // Update grandparent to no longer link to parent
                const updatedGrandparent = {
                  ...grandparent,
                  childrenNodeIds: (grandparent.childrenNodeIds || []).filter(
                    (id: number) => id !== parentNodeId
                  ),
                  latestChildNodeId:
                    grandparent.latestChildNodeId === parentNodeId
                      ? null
                      : grandparent.latestChildNodeId,
                };
                newMessageTree.set(grandparentNodeId, updatedGrandparent);
              }
            }
            // Remove the parent message
            newMessageTree.delete(parentNodeId);
          }
        }
        // Update the state immediately so subsequent logic uses the cleaned map
        updateSessionMessageTree(frozenSessionId, newMessageTree);
        console.log(
          "Removed previous error message ID:",
          lastMessage.messageId
        );

        // update state for the new world (with the error message removed)
        currentHistory = getLatestMessageChain(newMessageTree);
        currentMessageTreeLocal = newMessageTree;
        lastMessage = currentHistory[currentHistory.length - 1];
      }

      if (currentChatState != "input") {
        if (currentChatState == "uploading") {
          setPopup({
            message: "Please wait for the content to upload",
            type: "error",
          });
        } else {
          setPopup({
            message: "Please wait for the response to complete",
            type: "error",
          });
        }

        return;
      }

      clientScrollToBottom();

      let currChatSessionId: string;
      const isNewSession = existingChatSessionId === null;

      const searchParamBasedChatSessionName =
        searchParams?.get(SEARCH_PARAM_NAMES.TITLE) || null;
      if (isNewSession) {
        currChatSessionId = await createChatSession(
          liveAssistant?.id || 0,
          searchParamBasedChatSessionName,
          projectId ? parseInt(projectId) : null
        );
      } else {
        currChatSessionId = existingChatSessionId as string;
      }
      frozenSessionId = currChatSessionId;
      // update the selected model for the chat session if one is specified so that
      // it persists across page reloads. Do not `await` here so that the message
      // request can continue and this will just happen in the background.
      // NOTE: only set the model override for the chat session once we send a
      // message with it. If the user switches models and then starts a new
      // chat session, it is unexpected for that model to be used when they
      // return to this session the next day.
      let finalLLM = modelOverride || llmManager.currentLlm;
      updateLlmOverrideForChatSession(
        currChatSessionId,
        structureValue(
          finalLLM.name || "",
          finalLLM.provider || "",
          finalLLM.modelName || ""
        )
      );

      // mark the session as the current session
      updateStatesWithNewSessionId(currChatSessionId);

      // Navigate immediately for new sessions (before streaming starts)
      if (isNewSession) {
        handleNewSessionNavigation(currChatSessionId);
      }

      // set the ability to cancel the request
      const controller = new AbortController();
      setAbortController(currChatSessionId, controller);

      const messageToResend = currentHistory.find(
        (message) => message.messageId === messageIdToResend
      );
      if (messageIdToResend && regenerationRequest) {
        updateRegenerationState(
          { regenerating: true, finalMessageIndex: messageIdToResend + 1 },
          frozenSessionId
        );
      }
      const messageToResendParent =
        messageToResend?.parentNodeId !== null &&
        messageToResend?.parentNodeId !== undefined
          ? currentMessageTreeLocal.get(messageToResend.parentNodeId)
          : null;
      const messageToResendIndex = messageToResend
        ? currentHistory.indexOf(messageToResend)
        : null;

      if (!messageToResend && messageIdToResend !== undefined) {
        setPopup({
          message:
            "Failed to re-send message - please refresh the page and try again.",
          type: "error",
        });
        resetRegenerationState(frozenSessionId);
        updateChatStateAction(frozenSessionId, "input");
        return;
      }

      // When editing (messageIdToResend exists but no regenerationRequest), use the new message
      // When regenerating (regenerationRequest exists), use the original message
      let currMessage = regenerationRequest
        ? messageToResend?.message || message
        : message;

      updateChatStateAction(frozenSessionId, "loading");

      // find the parent
      const currMessageHistory =
        messageToResendIndex !== null
          ? currentHistory.slice(0, messageToResendIndex)
          : currentHistory;

      let parentMessage =
        messageToResendParent ||
        (currMessageHistory.length > 0
          ? currMessageHistory[currMessageHistory.length - 1]
          : null) ||
        (currentMessageTreeLocal.size === 1
          ? Array.from(currentMessageTreeLocal.values())[0]
          : null);

      // Add user message immediately to the message tree so that the chat
      // immediately reflects the user message
      let initialUserNode: Message;
      let initialAssistantNode: Message;

      if (regenerationRequest) {
        // For regeneration: keep the existing user message, only create new assistant
        initialUserNode = regenerationRequest.parentMessage;
        initialAssistantNode = buildEmptyMessage({
          messageType: "assistant",
          parentNodeId: initialUserNode.nodeId,
          nodeIdOffset: 1,
        });
      } else {
        // For new messages or editing: create/update user message and assistant
        const parentNodeIdForMessage = messageToResend
          ? messageToResend.parentNodeId || SYSTEM_NODE_ID
          : parentMessage?.nodeId || SYSTEM_NODE_ID;
        const result = buildImmediateMessages(
          parentNodeIdForMessage,
          currMessage,
          projectFilesToFileDescriptors(currentMessageFiles),
          messageToResend
        );
        initialUserNode = result.initialUserNode;
        initialAssistantNode = result.initialAssistantNode;
        const isCaseAnalysis =
          (liveAssistant && liveAssistant.id === 1) ||
          (liveAssistant && liveAssistant.name === "Case Analysis");

        if (isCaseAnalysis) {
          if (!initialUserNode.messageId) {
            initialUserNode.messageId = Date.now();
          }
          if (!initialAssistantNode.messageId) {
            initialAssistantNode.messageId = initialUserNode.messageId + 1;
          }
        }        
      }

      // make messages appear + clear input bar
      const messagesToUpsert = regenerationRequest
        ? [initialAssistantNode] // Only upsert the new assistant for regeneration
        : [initialUserNode, initialAssistantNode]; // Upsert both for normal/edit flow
      const newMessageDetails = upsertToCompleteMessageTree({
        messages: messagesToUpsert,
        completeMessageTreeOverride: currentMessageTreeLocal,
        chatSessionId: frozenSessionId,
      });
      resetInputBar();
      currentMessageTreeLocal = newMessageDetails.messageTree;

      // === Caseprediction Integration ===
      try {
        const isCaseAnalysis =
          (liveAssistant && liveAssistant.id === 1) ||
          (liveAssistant && liveAssistant.name === "Case Analysis");

        if (isCaseAnalysis) {
          console.log("Caseprediction routing active for Case Analysis assistant.");

        // CaseAnalysis-specific messageId enforcement (DO NOT apply globally)
        if (!initialUserNode.messageId) {
          initialUserNode.messageId = Date.now();
        }
        if (!initialAssistantNode.messageId) {
          initialAssistantNode.messageId = initialUserNode.messageId + 1;
        }  

          // Step 1: Placeholder message to show spinner text
          // Use the same assistant node id that will be replaced (initialAssistantNode.nodeId)
          // so edits / regenerations correctly overwrite the existing assistant node.

          const placeholderAssistant: Message = {
            ...initialAssistantNode,
            nodeId: initialAssistantNode.nodeId,
            messageId: initialAssistantNode.messageId, // CRITICAL FIX
            message: "Analyzing case details...",
            type: "assistant",
            toolCall: null,
            packets: [],
            parentNodeId: initialUserNode.nodeId,
            childrenNodeIds: [],
            latestChildNodeId: null,
          };
          // If this is an edit (messageToResend exists), remove assistant child nodes that
          // are direct children of initialUserNode to avoid orphan assistant nodes.
          if (messageToResend) {
            try {
              const cleaned = new Map(currentMessageTreeLocal);
              const existingChildren = initialUserNode?.childrenNodeIds || [];
              for (const childId of existingChildren) {
                const child = cleaned.get(childId);
                if (child && child.type === "assistant") {
                  cleaned.delete(childId);
                }
              }
              // update the tree now so placeholder upsert operates on cleaned tree
              currentMessageTreeLocal = cleaned;
              updateSessionMessageTree(frozenSessionId, currentMessageTreeLocal);
            } catch (err) {
              console.warn("Failed to cleanup previous assistant nodes for edit:", err);
            }
          }

          const placeholderUpdate = upsertToCompleteMessageTree({
            messages: [placeholderAssistant],
            completeMessageTreeOverride: currentMessageTreeLocal,
            chatSessionId: frozenSessionId,
            makeLatestChildMessage: true,
          });
          currentMessageTreeLocal = placeholderUpdate.messageTree;

          // Force UI update for placeholder
          updateSessionMessageTree(frozenSessionId, currentMessageTreeLocal);
          clientScrollToBottom();

          // Step 2: Call backend
          const response = await fetch("/api/caseprediction/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              query: currMessage,
              chat_session_id: currChatSessionId,
              parent_message_id: parentMessage?.messageId || null
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          console.log("Caseprediction API raw JSON:", data);

          // Step 3: Parse backend response
          const prediction = data.prediction === 1 ? "Accepted" : "Rejected";
          const confidence = data.confidence ? `Confidence: ${data.confidence}%` : "";
          const reasoning = data.reasoning || "No reasoning provided.";
          const finalMessage = `### Case Outcome: ${prediction}\n\n${confidence}\n\n${reasoning}`;

          // === GaugeMeter state updates ===
          // const confidenceNumeric = Number(data.confidence);

          // const conf = isNaN(confidenceNumeric) ? null : confidenceNumeric;
          // setCaseAnalysisConfidence(conf);
          // onCaseAnalysisConfidenceChange?.(conf);

          // setCaseAnalysisReasoning(reasoning);
          // onCaseAnalysisReasoningChange?.(reasoning);

          // setHasCaseAnalysisStarted(true);
          // onCaseAnalysisStartedChange?.(true);

          // Step 4: Create assistant message
          const finalAssistant: Message = {
            ...initialAssistantNode,
            message: finalMessage,
            type: "assistant",
            messageId: initialAssistantNode.messageId,
            files: [],
            toolCall: null,
            packets: [
              {
                ind: 0,
                obj: {
                  type: "message_start",
                  id: "casepred-start",
                  content: finalMessage,
                  final_documents: [],
                },
              },
              {
                ind: 1,
                obj: {
                  type: "stop",
                },
              },
            ],
            parentNodeId: initialUserNode.nodeId,
            childrenNodeIds: [],
            latestChildNodeId: null,
          };

          const finalUpdate = upsertToCompleteMessageTree({
            messages: [finalAssistant],
            completeMessageTreeOverride: currentMessageTreeLocal,
            chatSessionId: frozenSessionId,
            makeLatestChildMessage: true,
          });
          currentMessageTreeLocal = finalUpdate.messageTree;

          updateSessionMessageTree(frozenSessionId, new Map(currentMessageTreeLocal));

          updateChatStateAction(frozenSessionId, "input");
          resetRegenerationState(frozenSessionId);

          if (isNewSession && !searchParamBasedChatSessionName) {
            handleNewSessionNaming(currChatSessionId);
          }

          console.log("Caseprediction completed successfully. UI should now render the result.");
          return;
        }
          } catch (err: any) {
            const isAbort =
              err?.name === "AbortError" || // fetch throws this when aborted
              (typeof controller !== "undefined" && controller.signal?.aborted);

            if (isAbort) {
              console.debug("Caseprediction request aborted by user:", err);
              try {
                updateChatStateAction(frozenSessionId, "input");
                resetRegenerationState(frozenSessionId);
              } catch (e) {
              }
              return;
            }

            console.error("Caseprediction flow error:", err);

            const errorAssistant: Message = {
              ...initialAssistantNode,
              message: "Error while fetching case prediction. Please try again later.",
              type: "error",
              files: [],
              toolCall: null,
              packets: [],
              parentNodeId: initialUserNode.nodeId,
              childrenNodeIds: [],
              latestChildNodeId: null,
            };

            const errorUpdate = upsertToCompleteMessageTree({
              messages: [errorAssistant],
              completeMessageTreeOverride: currentMessageTreeLocal,
              chatSessionId: frozenSessionId,
              makeLatestChildMessage: true,
            });
            currentMessageTreeLocal = errorUpdate.messageTree;

            updateSessionMessageTree(frozenSessionId, currentMessageTreeLocal);
            updateChatStateAction(frozenSessionId, "input");
            resetRegenerationState(frozenSessionId);
            return;
          }   

          // Legacy Search Integration //
          // Route to /api/legacysearch/judgements/search if assistant is Legacy Search
          const isLegacySearch = liveAssistant?.name === "Legacy Search";
          if (isLegacySearch) {
            const cleaned = new Map(currentMessageTreeLocal);

            cleaned.set(initialAssistantNode.nodeId, {
              ...initialAssistantNode,
              message: "",
              packets: [],
              type: "assistant",
              childrenNodeIds: [],
              latestChildNodeId: null,
            });

            currentMessageTreeLocal = cleaned;
            updateSessionMessageTree(currChatSessionId, currentMessageTreeLocal);

            // Reuse the initial user node
            initialUserNode.message = currMessage;
          }      
          if (isLegacySearch && searchDomain === 'judgements') {
            try {
              const PAGE_SIZE = 5;
              const baseParams: QueryParams = {
                query: currMessage,
                courts: selectedCourts,
                judge_name: null,
                case_title: null,
                start_date: null,
                end_date: null,
                page_size: PAGE_SIZE,
                keywords: [], // no refine for the simple path
                keyword_logic: keywordLogic,
              };

              const response = await fetch("/api/legacysearch/judgements/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...baseParams,
                  page: 1,
                }),
              });

              if (!response.ok) throw new Error("Legacy Search failed");

              const result = await response.json(); // { results, total, sc_total, hc_total, page, page_size, has_more }
              if (result.benchmarks) {
                console.groupCollapsed(`Legacy Search Benchmarks (Basic) - ${result.total} results`);
                console.table(result.benchmarks);
                console.groupEnd();
              }              
              const queryId = Date.now().toString();

              // Keep results in history
              setSearchHistory(prev => [
                ...prev,
                {
                  id: queryId,
                  query: currMessage,
                  results: result.results,
                  meta: {
                    sc_total: result.sc_total,
                    hc_total: result.hc_total,
                    total: result.total,
                    page: 1,
                    page_size: PAGE_SIZE,
                    has_more: result.has_more,
                  },
                },
              ]);
              setSelectedQueryId(queryId);
              setRefineSnippetsByIndex({}); // reset refine state on fresh search

              // Register pager for "Show more"
              setPager(prev => ({
                ...prev,
                [queryId]: {
                  domain: 'judgements',
                  currentPage: 1,
                  totalPages: Math.max(1, Math.ceil((result.total ?? 0) / PAGE_SIZE)),
                  total: result.total ?? undefined,
                  pageSize: PAGE_SIZE,
                  hasMore: !!result.has_more,
                  params: baseParams,
                  cache: { 1: Array.isArray(result.results) ? [...result.results] : [] },
                },
              }));

              const newMessageId = Date.now();

              // const userMessage: Message = {
              //   messageId: newMessageId - 1,
              //   message: currMessage,
              //   type: "user",
              //   files: [],
              //   toolCall: null,
              // parentMessageId: parentMessage?.messageId || SYSTEM_MESSAGE_ID,
              //   parentNodeId: parentMessage?.nodeId ?? SYSTEM_NODE_ID,
              // };

              // Build user message — reuse original user node/message ids when this is an edit (messageToResend)
              const userMessage = { 
                ...initialUserNode,
                message: currMessage,
              };

              // If this is an edit/resend of an existing message, reuse that message's ids.
              // Otherwise ensure stable positive ids.
              if (messageToResend) {
                // reuse the original node/message ids when possible to preserve UI links
                userMessage.nodeId = messageToResend.nodeId;
                userMessage.messageId =
                  typeof messageToResend.messageId === "number" && messageToResend.messageId > 0
                    ? messageToResend.messageId
                    : Date.now();
                // remove any old assistant children of this user node so they don't create
                // multi-child indicators (0/2 or 1/2)                
              } else {
                userMessage.messageId = Date.now();
              }            

              // First page only: optionally inject empty blocks for SC/HC totals == 0
              let displayResults = [...result.results];
              if (bothCourtsSelected(selectedCourts)) {
                const hasSC = displayResults.some((r) => r.source === "SC");
                const hasHC = displayResults.some((r) => r.source === "HC");
                const scTotal = result.sc_total ?? 0;
                const hcTotal = result.hc_total ?? 0;
                if (!hasSC && scTotal === 0) displayResults.unshift(buildEmptySCRow());
                if (!hasHC && hcTotal === 0) displayResults.push(buildEmptyHCRow(highCourtsFrom(selectedCourts)));
              }

              const header = headerLine(0, result.results.length, result.total, result.sc_total, result.hc_total);
              const body = renderRowsChunk(displayResults, 0);

              // const assistantMessage: Message = {
              //   messageId: newMessageId,
              //   message: `${header}\n\n${body}`,
              //   type: "assistant",
              //   files: [],
              //   toolCall: null,
              // parentMessageId: userMessage.messageId,
              //   parentNodeId: userMessage.nodeId,
              // };

              // Build assistant message. Use nodeIdOffset to avoid collisions and make this message final.
              const assistantMessage = {
                ...initialAssistantNode,
                parentNodeId: userMessage.nodeId,
                messageId: userMessage.messageId + 1,
                message: `${header}\n\n${body}`,
                packets: [
                  {
                    ind: 0,
                    obj: {
                      type: "message_start" as const,
                      id: `legacy-start-${userMessage.messageId + 1}`,
                      content: `${header}\n\n${body}`,
                      final_documents: null,
                    },
                  },
                  {
                    ind: 1,
                    obj: {
                      type: "stop" as const,
                    },
                  },
                ],
                childrenNodeIds: [],
                latestChildNodeId: null,
              };

              // upsertToCompleteMessageMap({
              //   messages: [userMessage, assistantMessage],
              //   chatSessionId: currChatSessionId,
              // });

              const treeUpdate = upsertToCompleteMessageTree({
                messages: [userMessage, assistantMessage],
                completeMessageTreeOverride: currentMessageTreeLocal,
                chatSessionId: currChatSessionId,
                makeLatestChildMessage: true,
              });

              currentMessageTreeLocal = treeUpdate.messageTree;
              updateSessionMessageTree(currChatSessionId, currentMessageTreeLocal);              

              // await setMessageAsLatest(assistantMessage.messageId);
              updateChatStateAction(currChatSessionId, "input");
              resetRegenerationState(currChatSessionId);

            if (isNewSession && !searchParamBasedChatSessionName) {
                handleNewSessionNaming(currChatSessionId);
              }              
              return;
            } catch (error) {
              console.error("Legacy Search Error:", error);
              updateChatStateAction(currChatSessionId, "input");
              setPopup({ type: "error", message: "Legacy Search failed to respond." });
              return;
            }
          } else if (isLegacySearch && searchDomain === 'statutes') {
            try {
              const PAGE_SIZE = 5;
              const baseParams: StatutesQueryParams = {
                query: currMessage,
                statutes: [...selectedStatutes],
                section_title: null,
                page_size: PAGE_SIZE,
                keywords: [],
                keyword_logic: keywordLogic,
              };

              const result = await fetchStatutesPage(baseParams, 1, /*useAdvanced*/ false);
              const queryId = Date.now().toString();

              // store history
              setSearchHistory(prev => [
                ...prev,
                {
                  id: queryId,
                  query: currMessage,
                  results: result.results,
                  meta: {
                    central_total: result.central_total,
                    state_total: result.state_total,
                    total: result.total,
                    page: 1,
                    page_size: PAGE_SIZE,
                    has_more: result.has_more,
                  },
                },
              ]);
              setSelectedQueryId(queryId);
              setRefineSnippetsByIndex({});

              // register pager for Show More (statutes uses load-more UX)
              setPager(prev => ({
                ...prev,
                [queryId]: {
                  domain: 'statutes',
                  currentPage: 1,
                  totalPages: Math.max(1, Math.ceil((result.total ?? 0) / PAGE_SIZE)),
                  total: result.total ?? undefined,
                  pageSize: PAGE_SIZE,
                  hasMore: !!result.has_more,
                  params: baseParams, // StatutesQueryParams
                  cache: { 1: Array.isArray(result.results) ? [...result.results] : [] },
                },
              }));

              const newMessageId = Date.now();

              // const userMessage: Message = {
              //   messageId: newMessageId - 1,
              //   message: currMessage,
              //   type: "user",
              //   files: [],
              //   toolCall: null,
              // parentMessageId: parentMessage?.messageId || SYSTEM_MESSAGE_ID,
              // };

              // Build user message — reuse original user node/message ids when this is an edit (messageToResend)
              const userMessage = { 
                ...initialUserNode,
                message: currMessage,
              };

              // If this is an edit/resend of an existing message, reuse that message's ids.
              // Otherwise ensure stable positive ids.
              if (messageToResend) {
                // reuse the original node/message ids when possible to preserve UI links
                userMessage.nodeId = messageToResend.nodeId;
                userMessage.messageId =
                  typeof messageToResend.messageId === "number" && messageToResend.messageId > 0
                    ? messageToResend.messageId
                    : Date.now();
                // remove any old assistant children of this user node so they don't create
                // multi-child indicators (0/2 or 1/2)
                try {
                  const cleaned = new Map(currentMessageTreeLocal);
                  const existingChildren = messageToResend.childrenNodeIds || [];
                  for (const childId of existingChildren) {
                    const child = cleaned.get(childId);
                    if (child && child.type === "assistant") {
                      cleaned.delete(childId);
                    }
                  }
                  currentMessageTreeLocal = cleaned;
                  updateSessionMessageTree(currChatSessionId, currentMessageTreeLocal);
                } catch (err) {
                  console.warn("Failed to cleanup previous assistant nodes for legacy edit:", err);
                }
              } else {
                userMessage.messageId = Date.now();
              }             

              const header = headerLineStatutes(
                0,
                result.results.length,
                result.total,
                result.central_total,
                result.state_total
              );
              const body = renderRowsChunkStatutes(result.results, 0);

              // const assistantMessage: Message = {
              //   messageId: newMessageId,
              //   message: `${header}\n\n${body}`,
              //   type: "assistant",
              //   files: [],
              //   toolCall: null,
              // parentMessageId: userMessage.messageId,
              //   parentNodeId: userMessage.nodeId,
              // };

              // Build assistant message. Use nodeIdOffset to avoid collisions and make this message final.
              const assistantMessage = {
                ...initialAssistantNode,
                parentNodeId: userMessage.nodeId,
                messageId: userMessage.messageId + 1,
                message: `${header}\n\n${body}`,
                packets: [
                  {
                    ind: 0,
                    obj: {
                      type: "message_start" as const,
                      id: `legacy-start-${userMessage.messageId + 1}`,
                      content: `${header}\n\n${body}`,
                      final_documents: null,
                    },
                  },
                  {
                    ind: 1,
                    obj: {
                      type: "stop" as const,
                    },
                  },
                ],
                childrenNodeIds: [],
                latestChildNodeId: null,
              };         

              // upsertToCompleteMessageMap({
              //   messages: [userMessage, assistantMessage],
              //   chatSessionId: currChatSessionId,
              // });

              const treeUpdate = upsertToCompleteMessageTree({
                messages: [userMessage, assistantMessage],
                completeMessageTreeOverride: currentMessageTreeLocal,
                chatSessionId: currChatSessionId,
                makeLatestChildMessage: true,
              });

              currentMessageTreeLocal = treeUpdate.messageTree;
              updateSessionMessageTree(currChatSessionId, currentMessageTreeLocal);              

              // await setMessageAsLatest(assistantMessage.messageId);
              updateChatStateAction(currChatSessionId, "input");
              resetRegenerationState(currChatSessionId);

            if (isNewSession && !searchParamBasedChatSessionName) {
                handleNewSessionNaming(currChatSessionId);
              }              
              return;
            } catch (error) {
              console.error("Legacy Search (statutes) Error:", error);
              updateChatStateAction(currChatSessionId, "input");
              setPopup({ type: "error", message: "Legacy Search (statutes) failed to respond." });
              return;
            }
          }          

      let answer = "";

      const stopReason: StreamStopReason | null = null;
      let query: string | null = null;
      let retrievalType: RetrievalType =
        selectedDocuments.length > 0
          ? RetrievalType.SelectedDocs
          : RetrievalType.None;
      let documents: qilegalDocument[] = selectedDocuments;
      let citations: CitationMap | null = null;
      let aiMessageImages: FileDescriptor[] | null = null;
      let error: string | null = null;
      let stackTrace: string | null = null;

      let finalMessage: BackendMessage | null = null;
      let toolCall: ToolCallMetadata | null = null;
      let files = projectFilesToFileDescriptors(currentMessageFiles);
      let packets: Packet[] = [];

      let newUserMessageId: number | null = null;
      let newAssistantMessageId: number | null = null;

      try {
        const lastSuccessfulMessageId = getLastSuccessfulMessageId(
          currentMessageTreeLocal
        );
        const disabledToolIds = liveAssistant
          ? assistantPreferences?.[liveAssistant?.id]?.disabled_tool_ids
          : undefined;

        const stack = new CurrentMessageFIFO();
        updateCurrentMessageFIFO(stack, {
          signal: controller.signal,
          message: currMessage,
          alternateAssistantId: liveAssistant?.id,
          fileDescriptors: overrideFileDescriptors,
          parentMessageId: (() => {
            const parentId =
              regenerationRequest?.parentMessage.messageId ||
              messageToResendParent?.messageId ||
              lastSuccessfulMessageId;
            // Don't send SYSTEM_MESSAGE_ID (-3) as parent, use null instead
            // The backend expects null for "the first message in the chat"
            return parentId === SYSTEM_MESSAGE_ID ? null : parentId;
          })(),
          chatSessionId: currChatSessionId,
          filters: buildFilters(
            filterManager.selectedSources,
            filterManager.selectedDocumentSets,
            filterManager.timeRange,
            filterManager.selectedTags
          ),
          selectedDocumentIds: selectedDocuments
            .filter(
              (document) =>
                document.db_doc_id !== undefined && document.db_doc_id !== null
            )
            .map((document) => document.db_doc_id as number),
          queryOverride,
          forceSearch,
          currentMessageFiles: currentMessageFiles.map((file) => ({
            id: file.file_id,
            type: file.chat_file_type,
            name: file.name,
            user_file_id: file.id,
          })),
          regenerate: regenerationRequest !== undefined,
          modelProvider:
            modelOverride?.name || llmManager.currentLlm.name || undefined,
          modelVersion:
            modelOverride?.modelName ||
            llmManager.currentLlm.modelName ||
            searchParams?.get(SEARCH_PARAM_NAMES.MODEL_VERSION) ||
            undefined,
          temperature: llmManager.temperature || undefined,
          systemPromptOverride:
            searchParams?.get(SEARCH_PARAM_NAMES.SYSTEM_PROMPT) || undefined,
          useExistingUserMessage: isSeededChat,
          useAgentSearch,
          enabledToolIds:
            disabledToolIds && liveAssistant
              ? liveAssistant.tools
                  .filter((tool) => !disabledToolIds?.includes(tool.id))
                  .map((tool) => tool.id)
              : undefined,
          forcedToolIds: forcedToolIds,
        });

        const delay = (ms: number) => {
          return new Promise((resolve) => setTimeout(resolve, ms));
        };

        await delay(50);
        while (!stack.isComplete || !stack.isEmpty()) {
          if (stack.isEmpty()) {
            await delay(0.5);
          }

          if (!stack.isEmpty() && !controller.signal.aborted) {
            const packet = stack.nextPacket();
            if (!packet) {
              continue;
            }
            console.debug("Packet:", JSON.stringify(packet));

            // We've processed initial packets and are starting to stream content.
            // Transition from 'loading' to 'streaming'.
            updateChatStateAction(frozenSessionId, "streaming");

            if ((packet as MessageResponseIDInfo).user_message_id) {
              newUserMessageId = (packet as MessageResponseIDInfo)
                .user_message_id;
            }

            if (
              (packet as MessageResponseIDInfo).reserved_assistant_message_id
            ) {
              newAssistantMessageId = (packet as MessageResponseIDInfo)
                .reserved_assistant_message_id;
            }

            if (Object.hasOwn(packet, "user_files")) {
              const userFiles = (packet as UserKnowledgeFilePacket).user_files;
              // Ensure files are unique by id
              const newUserFiles = userFiles.filter(
                (newFile) =>
                  !files.some((existingFile) => existingFile.id === newFile.id)
              );
              files = files.concat(newUserFiles);
            }

            if (Object.hasOwn(packet, "file_ids")) {
              aiMessageImages = (packet as FileChatDisplay).file_ids.map(
                (fileId) => {
                  return {
                    id: fileId,
                    type: ChatFileType.IMAGE,
                  };
                }
              );
            } else if (
              Object.hasOwn(packet, "error") &&
              (packet as any).error != null
            ) {
              setUncaughtError(
                frozenSessionId,
                (packet as StreamingError).error
              );
              updateChatStateAction(frozenSessionId, "input");
              updateSubmittedMessage(getCurrentSessionId(), "");

              throw new Error((packet as StreamingError).error);
            } else if (Object.hasOwn(packet, "message_id")) {
              finalMessage = packet as BackendMessage;
            } else if (Object.hasOwn(packet, "stop_reason")) {
              const stop_reason = (packet as StreamStopInfo).stop_reason;
              if (stop_reason === StreamStopReason.CONTEXT_LENGTH) {
                updateCanContinue(true, frozenSessionId);
              }
            } else if (Object.hasOwn(packet, "obj")) {
              console.debug("Object packet:", JSON.stringify(packet));
              packets.push(packet as Packet);

              // Check if the packet contains document information
              const packetObj = (packet as Packet).obj;

              if (packetObj.type === "citation_delta") {
                const citationDelta = packetObj as CitationDelta;
                if (citationDelta.citations) {
                  citations = Object.fromEntries(
                    citationDelta.citations.map((c) => [
                      c.document_id,
                      c.citation_num,
                    ])
                  );
                }
              } else if (packetObj.type === "message_start") {
                const messageStart = packetObj as MessageStart;
                if (messageStart.final_documents) {
                  documents = messageStart.final_documents;
                  updateSelectedNodeForDocDisplay(
                    frozenSessionId,
                    initialAssistantNode.nodeId
                  );
                }
              }
            } else {
              console.warn("Unknown packet:", JSON.stringify(packet));
            }

            // on initial message send, we insert a dummy system message
            // set this as the parent here if no parent is set
            parentMessage =
              parentMessage || currentMessageTreeLocal?.get(SYSTEM_NODE_ID)!;

            const newMessageDetails = upsertToCompleteMessageTree({
              messages: [
                {
                  ...initialUserNode,
                  messageId: newUserMessageId ?? undefined,
                  files: files,
                },
                {
                  ...initialAssistantNode,
                  messageId: newAssistantMessageId ?? undefined,
                  message: error || answer,
                  type: error ? "error" : "assistant",
                  retrievalType,
                  query: finalMessage?.rephrased_query || query,
                  documents: documents,
                  citations: finalMessage?.citations || citations || {},
                  files: finalMessage?.files || aiMessageImages || [],
                  toolCall: finalMessage?.tool_call || toolCall,
                  stackTrace: stackTrace,
                  overridden_model: finalMessage?.overridden_model,
                  stopReason: stopReason,
                  packets: packets,
                },
              ],
              // Pass the latest map state
              completeMessageTreeOverride: currentMessageTreeLocal,
              chatSessionId: frozenSessionId!,
            });
            currentMessageTreeLocal = newMessageDetails.messageTree;
          }
        }
      } catch (e: any) {
        console.log("Error:", e);
        const errorMsg = e.message;
        const newMessageDetails = upsertToCompleteMessageTree({
          messages: [
            {
              nodeId: initialUserNode.nodeId,
              message: currMessage,
              type: "user",
              files: currentMessageFiles.map((file) => ({
                id: file.file_id,
                type: file.chat_file_type,
                name: file.name,
                user_file_id: file.id,
              })),
              toolCall: null,
              parentNodeId: parentMessage?.nodeId || SYSTEM_NODE_ID,
              packets: [],
            },
            {
              nodeId: initialAssistantNode.nodeId,
              message: errorMsg,
              type: "error",
              files: aiMessageImages || [],
              toolCall: null,
              parentNodeId: initialUserNode.nodeId,
              packets: [],
            },
          ],
          completeMessageTreeOverride: currentMessageTreeLocal,
        });
        currentMessageTreeLocal = newMessageDetails.messageTree;
      }

      resetRegenerationState(frozenSessionId);
      updateChatStateAction(frozenSessionId, "input");

      // Name the chat now that we have AI response (navigation already happened before streaming)
      if (isNewSession && !searchParamBasedChatSessionName) {
        handleNewSessionNaming(currChatSessionId);
      }
    },
    [
      // Narrow to stable fields from managers to avoid re-creation
      filterManager.selectedSources,
      filterManager.selectedDocumentSets,
      filterManager.selectedTags,
      filterManager.timeRange,
      llmManager.currentLlm,
      llmManager.temperature,
      // Others that affect logic
      liveAssistant,
      availableAssistants,
      existingChatSessionId,
      selectedDocuments,
      searchParams,
      setPopup,
      clientScrollToBottom,
      resetInputBar,
      setSelectedAssistantFromId,
      updateSelectedNodeForDocDisplay,
      currentMessageTree,
      currentChatState,
      // Ensure latest forced tools are used when submitting
      forcedToolIds,
      // Keep tool preference-derived values fresh
      assistantPreferences,
      fetchProjects,
    ]
  );

  const handleMessageSpecificFileUpload = useCallback(
    async (acceptedFiles: File[]) => {
      const [_, llmModel] = getFinalLLM(
        llmManager.llmProviders || [],
        liveAssistant || null,
        llmManager.currentLlm
      );
      const llmAcceptsImages = modelSupportsImageInput(
        llmManager.llmProviders || [],
        llmModel
      );

      const imageFiles = acceptedFiles.filter((file) =>
        file.type.startsWith("image/")
      );

      if (imageFiles.length > 0 && !llmAcceptsImages) {
        setPopup({
          type: "error",
          message:
            "The current model does not support image input. Please select a model with Vision support.",
        });
        return;
      }
      updateChatStateAction(getCurrentSessionId(), "uploading");
      const uploadedMessageFiles = await beginUpload(
        Array.from(acceptedFiles),
        null,
        setPopup
      );
      setCurrentMessageFiles((prev) => [...prev, ...uploadedMessageFiles]);
      updateChatStateAction(getCurrentSessionId(), "input");
    },
    [liveAssistant, llmManager, forcedToolIds]
  );

  useEffect(() => {
    return () => {
      // Cleanup which only runs when the component unmounts (i.e. when you navigate away).
      const currentSession = getCurrentSessionId();
      const abortController = sessions.get(currentSession)?.abortController;
      if (abortController) {
        abortController.abort();
        setAbortController(currentSession, new AbortController());
      }
    };
  }, [pathname]);

  // update chosen assistant if we navigate between pages
  useEffect(() => {
    if (currentMessageHistory.length === 0 && existingChatSessionId === null) {
      // Select from available assistants so shared assistants appear.
      setSelectedAssistantFromId(null);
    }
  }, [
    existingChatSessionId,
    availableAssistants,
    currentMessageHistory.length,
  ]);

  useEffect(() => {
    const handleSlackChatRedirect = async () => {
      const slackChatId = searchParams.get("slackChatId");
      if (!slackChatId) return;

      // Set isReady to false before starting retrieval to display loading text
      const currentSessionId = getCurrentSessionId();
      if (currentSessionId) {
        setIsReady(currentSessionId, false);
      }

      try {
        const response = await fetch("/api/chat/seed-chat-session-from-slack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_session_id: slackChatId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to seed chat from Slack");
        }

        const data = await response.json();

        router.push(data.redirect_url);
      } catch (error) {
        console.error("Error seeding chat from Slack:", error);
        setPopup({
          message: "Failed to load chat from Slack",
          type: "error",
        });
      }
    };

    handleSlackChatRedirect();
  }, [searchParams, router]);

  // fetch # of allowed document tokens for the selected Persona
  useEffect(() => {
    async function fetchMaxTokens() {
      const response = await fetch(
        `/api/chat/max-selected-document-tokens?persona_id=${liveAssistant?.id}`
      );
      if (response.ok) {
        const maxTokens = (await response.json()).max_tokens as number;
        setMaxTokens(maxTokens);
      }
    }
    fetchMaxTokens();
  }, [liveAssistant]);

  // check if there's an image file in the message history so that we know
  // which LLMs are available to use
  const imageFileInMessageHistory = useMemo(() => {
    return currentMessageHistory
      .filter((message) => message.type === "user")
      .some((message) =>
        message.files.some((file) => file.type === ChatFileType.IMAGE)
      );
  }, [currentMessageHistory]);

  useEffect(() => {
    llmManager.updateImageFilesPresent(imageFileInMessageHistory);
  }, [imageFileInMessageHistory]);

  // set isReady once component is mounted
  useEffect(() => {
    const currentSessionId = getCurrentSessionId();
    if (currentSessionId) {
      setIsReady(currentSessionId, true);
    }
  }, []); 

return {
  // actions
  onSubmit,
  stopGenerating,
  handleMessageSpecificFileUpload,
  
  // Legacy Search - ALL state and functions
  legacySearch: {
    // State variables
    showPopup,
    setShowPopup,
    isSearching,
    isDropdownOpen,
    setIsDropdownOpen,
    searchDomain,
    setSearchDomain,
    selectedCourts,
    setSelectedCourts,
    searchHistory,
    setSearchHistory,
    selectedQueryId,
    setSelectedQueryId,
    refineSnippetsByIndex,
    setRefineSnippetsByIndex,
    pager,
    setPager,
    selectedStatutes,
    setSelectedStatutes,
    pendingStatutes,
    setPendingStatutes,
    statutesScopeWarnText,
    setStatutesScopeWarnText,
    showStatutesScopeWarn,
    setShowStatutesScopeWarn,
    newKeyword,
    setNewKeyword,
    keywords,
    setKeywords,
    showAdvancedOption,
    setShowAdvancedOption,
    judgeName,
    setJudgeName,
    caseName,
    setCaseName,
    showDatePopup,
    setShowDatePopup,
    pendingCourts,
    setPendingCourts,
    scopeWarnText,
    setScopeWarnText,
    showScopeWarn,
    setShowScopeWarn,
    loadingCourts,
    setLoadingCourts,
    courtsList,
    setCourtsList,
    sectionTitle,
    setSectionTitle,
    loadingStates,
    setLoadingStates,
    statesList,
    setStatesList,
    showClearConfirm,
    setShowClearConfirm,
    state,
    setState,
    lastAppliedSummary,
    setLastAppliedSummary,
    lastAppliedCtx,
    setLastAppliedCtx,
    lastAppliedStatutesCtx,
    setLastAppliedStatutesCtx,
    isAllCourtsSelected,
    toggleAllCourts,
    isAllStatutesSelected,
    toggleAllStatutes,

    // Helper functions
    bothCourtsSelected,
    highCourtsFrom,
    headerLine,
    headerLineStatutes,
    renderRowsChunk,
    renderSCEmptyBlock,
    renderHCEmptyBlock,
    getFullBodyFromRow,
    toBlockquote,
    renderSCBlock,
    renderHCBlock,
    getFullBodyFromStatuteRow,
    renderCentralActBlock,
    renderStateActBlock,
    renderAnyRowStatutes,
    renderRowsChunkStatutes,
    fetchStatutesPage,
    renderAnyRow,
    buildEmptySCRow,
    buildEmptyHCRow,
    haveAnyStatutesFilters,
    prettyStatutes,
    deriveStatutesScopeFromSources,
    isStatuteChecked,
    toggleStatute,
    acceptStatutesChangeKeep,
    acceptStatutesChangeClear,
    cancelStatutesChange,
    acceptCourtChangeKeep,
    acceptCourtChangeClear,
    cancelCourtChange,
    deriveScopeFromCourts,
    haveAnyFilters,
    toggleCourt,
    isCourtChecked,
    toggleDatePopup,
    currentRange,
    // statutesSearchableText,
    // escapeRegExp,
    // statutesMatchesAllKeywordsStrict,
    // normalizeCaseTitleInput,
    // normalizeJudgeNameInput,
    makeQueryParams,
    splitMixedParams,
    fetchJudgementsPage,
    buildAppliedSummary,
    clearAllConfigFields,
    applyConfiguration,
    addKeyword,
    removeKeyword,
    loadingPageFor, 
    setLoadingPageFor,
    
    // PAGINATION SPECIFIC - COMPUTED PROPERTIES
    showLegacyPager,
    showLegacyPagerStatutes,
    selectedHistory: selectedHistory || undefined, 
    
    // PAGINATION SPECIFIC - FUNCTIONS
    goToPage,
    goToPageStatutes,
    pageList,  
    keywordLogic,
    setKeywordLogic,
  }}
};
