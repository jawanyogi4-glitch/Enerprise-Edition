"use client";

import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { DatePicker } from "@mui/x-date-pickers";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { IoMdClose } from "react-icons/io";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { toast } from "sonner";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { HealthCheckBanner } from "@/components/health/healthcheck";
import {
  personaIncludesRetrieval,
  useScrollonStream,
  getAvailableContextTokens,
} from "@/app/chat/services/lib";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePopup } from "@/components/admin/connectors/Popup";
import { SEARCH_PARAM_NAMES } from "@/app/chat/services/searchParams";
import { useFederatedConnectors, useFilters, useLlmManager } from "@/lib/hooks";
import { QiLegalInitializingLoader } from "@/components/qilegalInitializingLoader";
import { FiArrowDown } from "react-icons/fi";
import {
  qilegalDocument,
  MinimalqilegalDocument,
} from "@/lib/search/interfaces";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import Dropzone from "react-dropzone";
import ChatInputBar from "@/app/chat/components/input/ChatInputBar";
import { useChatContext } from "@/refresh-components/contexts/ChatContext";
import { ChatPopup } from "@/app/chat/components/ChatPopup";
import ExceptionTraceModal from "@/components/modals/ExceptionTraceModal";
import { SEARCH_TOOL_ID } from "@/app/chat/components/tools/constants";
import { useUser } from "@/components/user/UserProvider";
import { NoAssistantModal } from "@/components/modals/NoAssistantModal";
import { useAgentsContext } from "@/refresh-components/contexts/AgentsContext";
import TextView from "@/components/chat/TextView";
import { Modal } from "@/components/Modal";
import { useSendMessageToParent } from "@/lib/extension/utils";
import { SUBMIT_MESSAGE_TYPES } from "@/lib/extension/constants";
import { getSourceMetadata } from "@/lib/sources";
import { SourceMetadata } from "@/lib/search/interfaces";
import { FederatedConnectorDetail, UserRole, ValidSources } from "@/lib/types";
import { ChatSearchModal } from "@/app/chat/chat_search/ChatSearchModal";
import { useScreenSize } from "@/hooks/useScreenSize";
import { DocumentResults } from "@/app/chat/components/documentSidebar/DocumentResults";
import { useChatController } from "@/app/chat/hooks/useChatController";
import { useAssistantController } from "@/app/chat/hooks/useAssistantController";
import { useChatSessionController } from "@/app/chat/hooks/useChatSessionController";
import { useDeepResearchToggle } from "@/app/chat/hooks/useDeepResearchToggle";
import {
  useChatSessionStore,
  useMaxTokens,
  useChatPageLayout,
  useUncaughtError,
} from "@/app/chat/stores/useChatSessionStore";
import {
  useCurrentChatState,
  useIsReady,
  useCurrentMessageTree,
  useHasPerformedInitialScroll,
  useDocumentSidebarVisible,
  useHasSentLocalUserMessage,
} from "@/app/chat/stores/useChatSessionStore";
import { FederatedOAuthModal } from "@/components/chat/FederatedOAuthModal";
import { MessagesDisplay } from "@/app/chat/components/MessagesDisplay";
import WelcomeMessage from "@/app/chat/components/WelcomeMessage";
import ProjectContextPanel from "@/app/chat/components/projects/ProjectContextPanel";
import { useProjectsContext } from "@/app/chat/projects/ProjectsContext";
import {
  getProjectTokenCount,
  getMaxSelectedDocumentTokens,
} from "@/app/chat/projects/projectsService";
import ProjectChatSessionList from "@/app/chat/components/projects/ProjectChatSessionList";
import { cn } from "@/lib/utils";
import { Suggestions } from "@/sections/Suggestions";
import OnboardingFlow from "@/refresh-components/onboarding/OnboardingFlow";
import { useOnboardingState } from "@/refresh-components/onboarding/useOnboardingState";
import { OnboardingStep } from "@/refresh-components/onboarding/types";
import GaugeMeter from "@/components/GaugeMeter";
import { Message } from "@/app/chat/interfaces";

const DEFAULT_CONTEXT_TOKENS = 120_000;
interface ChatPageProps {
  documentSidebarInitialWidth?: number;
  firstMessage?: string;
}

export default function ChatPage({
  documentSidebarInitialWidth,
  firstMessage,
}: ChatPageProps) {
  // Performance tracking
  // Keeping this here in case we need to track down slow renders in the future
  // const renderCount = useRef(0);
  // renderCount.current++;
  // const renderStartTime = performance.now();

  // useEffect(() => {
  //   const renderTime = performance.now() - renderStartTime;
  //   if (renderTime > 10) {
  //     console.log(
  //       `[ChatPage] Slow render #${renderCount.current}: ${renderTime.toFixed(
  //         2
  //       )}ms`
  //     );
  //   }
  // });

  const router = useRouter();
  const searchParams = useSearchParams();

  const { chatSessions, ccPairs, tags, documentSets, refreshChatSessions } =
    useChatContext();

  const {
    currentMessageFiles,
    setCurrentMessageFiles,
    currentProjectId,
    currentProjectDetails,
    lastFailedFiles,
    clearLastFailedFiles,
  } = useProjectsContext();

  const { height: screenHeight } = useScreenSize();

  // handle redirect if chat page is disabled
  // NOTE: this must be done here, in a client component since
  // settings are passed in via Context and therefore aren't
  // available in server-side components
  const settings = useContext(SettingsContext);
  const enterpriseSettings = settings?.enterpriseSettings;

  const isInitialLoad = useRef(true);

  const { agents: availableAssistants } = useAgentsContext();

  // Also fetch federated connectors for the sources list
  const { data: federatedConnectorsData } = useFederatedConnectors();

  const { user, isAdmin } = useUser();
  const existingChatIdRaw = searchParams?.get("chatId");

  const existingChatSessionId = existingChatIdRaw ? existingChatIdRaw : null;

  const selectedChatSession = chatSessions.find(
    (chatSession) => chatSession.id === existingChatSessionId
  );

  function processSearchParamsAndSubmitMessage(searchParamsString: string) {
    const newSearchParams = new URLSearchParams(searchParamsString);
    const message = newSearchParams?.get("user-prompt");

    filterManager.buildFiltersFromQueryString(
      newSearchParams.toString(),
      sources,
      documentSets.map((ds) => ds.name),
      tags
    );

    newSearchParams.delete(SEARCH_PARAM_NAMES.SEND_ON_LOAD);

    router.replace(`?${newSearchParams.toString()}`, { scroll: false });

    // If there's a message, submit it
    if (message) {
      onSubmit({
        message,
        currentMessageFiles,
        useAgentSearch: deepResearchEnabled,
      });
    }
  }

  const { selectedAssistant, setSelectedAssistantFromId, liveAssistant } =
    useAssistantController({
      selectedChatSession,
      onAssistantSelect: () => {
        // Only remove project context if user explicitly selected an assistant
        // (i.e., assistantId is present). Avoid clearing project when assistantId was removed.
        const newSearchParams = new URLSearchParams(
          searchParams?.toString() || ""
        );
        if (newSearchParams.has("assistantId")) {
          newSearchParams.delete("projectid");
          router.replace(`?${newSearchParams.toString()}`, { scroll: false });
        }
      },
    });

  const { deepResearchEnabled, toggleDeepResearch } = useDeepResearchToggle({
    chatSessionId: existingChatSessionId,
    assistantId: selectedAssistant?.id,
  });

  const [presentingDocument, setPresentingDocument] =
    useState<MinimalqilegalDocument | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Gauge Meter local UI state
  // const [caseAnalysisConfidence, _setCaseAnalysisConfidenceLocal] = useState<
  //   number | null
  // >(null);
  // const [hasCaseAnalysisStarted, _setHasCaseAnalysisStartedLocal] =
  //   useState(false);

  // // RESET GAUGE WHEN ASSISTANT CHANGES AWAY FROM CASE ANALYSIS
  // useEffect(() => {
  //   if (liveAssistant?.name !== "Case Analysis") {
  //     _setCaseAnalysisConfidenceLocal(null);
  //     _setHasCaseAnalysisStartedLocal(false);
  //   }
  // }, [liveAssistant]);

  // Initialize onboarding state
  const {
    state: onboardingState,
    actions: onboardingActions,
    llmDescriptors,
  } = useOnboardingState(liveAssistant);

  const llmManager = useLlmManager(selectedChatSession, liveAssistant);

  // On first render, open onboarding if there are no configured LLM providers.
  // Only check once to avoid re-triggering onboarding when data refreshes.
  useEffect(() => {
    setShowOnboarding(llmManager.hasAnyProvider === false);
  }, []);

  const noAssistants = liveAssistant === null || liveAssistant === undefined;

  const availableSources: ValidSources[] = useMemo(() => {
    return ccPairs.map((ccPair) => ccPair.source);
  }, [ccPairs]);

  const sources: SourceMetadata[] = useMemo(() => {
    const uniqueSources = Array.from(new Set(availableSources));
    const regularSources = uniqueSources.map((source) =>
      getSourceMetadata(source)
    );

    // Add federated connectors as sources
    const federatedSources =
      federatedConnectorsData?.map((connector: FederatedConnectorDetail) => {
        return getSourceMetadata(connector.source);
      }) || [];

    // Combine sources and deduplicate based on internalName
    const allSources = [...regularSources, ...federatedSources];
    const deduplicatedSources = allSources.reduce((acc, source) => {
      const existing = acc.find((s) => s.internalName === source.internalName);
      if (!existing) {
        acc.push(source);
      }
      return acc;
    }, [] as SourceMetadata[]);

    return deduplicatedSources;
  }, [availableSources, federatedConnectorsData]);

  const { popup, setPopup } = usePopup();

  // Show popup if any files failed in ProjectsContext reconciliation
  useEffect(() => {
    if (lastFailedFiles && lastFailedFiles.length > 0) {
      const names = lastFailedFiles.map((f) => f.name).join(", ");
      setPopup({
        type: "error",
        message:
          lastFailedFiles.length === 1
            ? `File failed and was removed: ${names}`
            : `Files failed and were removed: ${names}`,
      });
      clearLastFailedFiles();
    }
  }, [lastFailedFiles, setPopup, clearLastFailedFiles]);

  const [message, setMessage] = useState(
    searchParams?.get(SEARCH_PARAM_NAMES.USER_PROMPT) || ""
  );

  const [projectPanelVisible, setProjectPanelVisible] = useState(true);

  const filterManager = useFilters();
  const [isChatSearchModalOpen, setIsChatSearchModalOpen] = useState(false);

  const [aboveHorizon, setAboveHorizon] = useState(false);

  const scrollableDivRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const endDivRef = useRef<HTMLDivElement>(null);
  const endPaddingRef = useRef<HTMLDivElement>(null);

  const scrollInitialized = useRef(false);

  const previousHeight = useRef<number>(
    inputRef.current?.getBoundingClientRect().height!
  );
  const scrollDist = useRef<number>(0);

  // Reset scroll state when switching chat sessions
  useEffect(() => {
    scrollDist.current = 0;
    setAboveHorizon(false);
  }, [existingChatSessionId]);

  function handleInputResize() {
    setTimeout(() => {
      if (
        inputRef.current &&
        lastMessageRef.current &&
        !waitForScrollRef.current
      ) {
        const newHeight: number =
          inputRef.current?.getBoundingClientRect().height!;
        const heightDifference = newHeight - previousHeight.current;
        if (
          previousHeight.current &&
          heightDifference != 0 &&
          endPaddingRef.current &&
          scrollableDivRef &&
          scrollableDivRef.current
        ) {
          endPaddingRef.current.style.transition = "height 0.3s ease-out";
          endPaddingRef.current.style.height = `${Math.max(
            newHeight - 50,
            0
          )}px`;

          if (autoScrollEnabled) {
            scrollableDivRef?.current.scrollBy({
              left: 0,
              top: Math.max(heightDifference, 0),
              behavior: "smooth",
            });
          }
        }
        previousHeight.current = newHeight;
      }
    }, 100);
  }

  const resetInputBar = useCallback(() => {
    setMessage("");
    setCurrentMessageFiles([]);
    if (endPaddingRef.current) {
      endPaddingRef.current.style.height = `95px`;
    }
  }, [setMessage, setCurrentMessageFiles]);

  const debounceNumber = 100; // time for debouncing

  // handle re-sizing of the text area
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    handleInputResize();
  }, [message]);

  // Add refs needed by useChatSessionController
  const chatSessionIdRef = useRef<string | null>(existingChatSessionId);
  const loadedIdSessionRef = useRef<string | null>(existingChatSessionId);
  const submitOnLoadPerformed = useRef<boolean>(false);

  // used for resizing of the document sidebar
  const masterFlexboxRef = useRef<HTMLDivElement>(null);
  const [maxDocumentSidebarWidth, setMaxDocumentSidebarWidth] = useState<
    number | null
  >(null);
  function adjustDocumentSidebarWidth() {
    if (masterFlexboxRef.current && document.documentElement.clientWidth) {
      // numbers below are based on the actual width the center section for different
      // screen sizes. `1700` corresponds to the custom "3xl" tailwind breakpoint
      // NOTE: some buffer is needed to account for scroll bars
      if (document.documentElement.clientWidth > 1700) {
        setMaxDocumentSidebarWidth(masterFlexboxRef.current.clientWidth - 950);
      } else if (document.documentElement.clientWidth > 1420) {
        setMaxDocumentSidebarWidth(masterFlexboxRef.current.clientWidth - 760);
      } else {
        setMaxDocumentSidebarWidth(masterFlexboxRef.current.clientWidth - 660);
      }
    }
  }

  function loadNewPageLogic(event: MessageEvent) {
    if (event.data.type === SUBMIT_MESSAGE_TYPES.PAGE_CHANGE) {
      try {
        const url = new URL(event.data.href);
        processSearchParamsAndSubmitMessage(url.searchParams.toString());
      } catch (error) {
        console.error("Error parsing URL:", error);
      }
    }
  }

  // Equivalent to `loadNewPageLogic`
  useEffect(() => {
    if (searchParams?.get(SEARCH_PARAM_NAMES.SEND_ON_LOAD)) {
      processSearchParamsAndSubmitMessage(searchParams.toString());
    }
  }, [searchParams, router]);

  useEffect(() => {
    adjustDocumentSidebarWidth();
    window.addEventListener("resize", adjustDocumentSidebarWidth);
    window.addEventListener("message", loadNewPageLogic);

    return () => {
      window.removeEventListener("message", loadNewPageLogic);
      window.removeEventListener("resize", adjustDocumentSidebarWidth);
    };
  }, []);

  if (!documentSidebarInitialWidth && maxDocumentSidebarWidth) {
    documentSidebarInitialWidth = Math.min(700, maxDocumentSidebarWidth);
  }

  const [selectedDocuments, setSelectedDocuments] = useState<qilegalDocument[]>(
    []
  );

  // Access chat state directly from the store
  const currentChatState = useCurrentChatState();
  const chatSessionId = useChatSessionStore((state) => state.currentSessionId);
  const uncaughtError = useUncaughtError();
  const isReady = useIsReady();
  const maxTokens = useMaxTokens();
  const completeMessageTree = useCurrentMessageTree();
  const hasPerformedInitialScroll = useHasPerformedInitialScroll();
  const currentSessionHasSentLocalUserMessage = useHasSentLocalUserMessage();
  const documentSidebarVisible = useDocumentSidebarVisible();
  const updateHasPerformedInitialScroll = useChatSessionStore(
    (state) => state.updateHasPerformedInitialScroll
  );
  const updateCurrentDocumentSidebarVisible = useChatSessionStore(
    (state) => state.updateCurrentDocumentSidebarVisible
  );
  const { showCenteredInput, loadingError, messageHistory } =
    useChatPageLayout();

  const clientScrollToBottom = useCallback(
    (fast?: boolean) => {
      waitForScrollRef.current = true;

      setTimeout(() => {
        if (!endDivRef.current || !scrollableDivRef.current) {
          console.error("endDivRef or scrollableDivRef not found");
          return;
        }

        const rect = endDivRef.current.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

        if (isVisible) return;

        // Check if all messages are currently rendered
        // If all messages are already rendered, scroll immediately
        endDivRef.current.scrollIntoView({
          behavior: fast ? "auto" : "smooth",
        });

        if (chatSessionIdRef.current) {
          updateHasPerformedInitialScroll(chatSessionIdRef.current, true);
        }
      }, 50);

      // Reset waitForScrollRef after 1.5 seconds
      setTimeout(() => {
        waitForScrollRef.current = false;
      }, 1500);
    },
    [updateHasPerformedInitialScroll]
  );

  const {
    onSubmit,
    stopGenerating,
    handleMessageSpecificFileUpload,
    legacySearch,
  } = useChatController({
    filterManager,
    llmManager,
    availableAssistants,
    liveAssistant,
    existingChatSessionId,
    selectedDocuments,
    searchParams,
    setPopup,
    clientScrollToBottom,
    resetInputBar,
    setSelectedAssistantFromId,
    // onCaseAnalysisConfidenceChange: _setCaseAnalysisConfidenceLocal,
    // onCaseAnalysisStartedChange: _setHasCaseAnalysisStartedLocal,
    // onCaseAnalysisReasoningChange: undefined,
  });

  const { onMessageSelection, currentSessionFileTokenCount, projectFiles } =
    useChatSessionController({
      existingChatSessionId,
      searchParams,
      filterManager,
      firstMessage,
      setSelectedAssistantFromId,
      setSelectedDocuments,
      setCurrentMessageFiles,
      chatSessionIdRef,
      loadedIdSessionRef,
      textAreaRef,
      scrollInitialized,
      isInitialLoad,
      submitOnLoadPerformed,
      hasPerformedInitialScroll,
      clientScrollToBottom,
      refreshChatSessions,
      onSubmit,
    });

  const autoScrollEnabled = user?.preferences?.auto_scroll ?? false;

  useScrollonStream({
    chatState: currentChatState,
    scrollableDivRef,
    scrollDist,
    endDivRef,
    debounceNumber,
    mobile: settings?.isMobile,
    enableAutoScroll: autoScrollEnabled,
  });

  const getContainerHeight = useMemo(() => {
    return () => {
      if (!currentSessionHasSentLocalUserMessage) {
        return undefined;
      }
      if (autoScrollEnabled) return undefined;

      if (screenHeight < 600) return "40vh";
      if (screenHeight < 1200) return "50vh";
      return "60vh";
    };
  }, [autoScrollEnabled, screenHeight, currentSessionHasSentLocalUserMessage]);

  const waitForScrollRef = useRef(false);

  useSendMessageToParent();

  const retrievalEnabled = useMemo(() => {
    if (liveAssistant) {
      return liveAssistant.tools.some(
        (tool) => tool.in_code_tool_id === SEARCH_TOOL_ID
      );
    }
    return false;
  }, [liveAssistant]);

  useEffect(() => {
    if (
      (!personaIncludesRetrieval &&
        (!selectedDocuments || selectedDocuments.length === 0) &&
        documentSidebarVisible) ||
      chatSessionId == undefined
    ) {
      updateCurrentDocumentSidebarVisible(false);
    }
    clientScrollToBottom();
  }, [chatSessionId]);

  const [stackTraceModalContent, setStackTraceModalContent] = useState<
    string | null
  >(null);

  const HORIZON_DISTANCE = 800;
  const handleScroll = useCallback(() => {
    const scrollDistance =
      endDivRef?.current?.getBoundingClientRect()?.top! -
      inputRef?.current?.getBoundingClientRect()?.top!;
    scrollDist.current = scrollDistance;
    setAboveHorizon(scrollDist.current > HORIZON_DISTANCE);
  }, []);

  function handleResubmitLastMessage() {
    // Grab the last user-type message
    const lastUserMsg = messageHistory
      .slice()
      .reverse()
      .find((m) => m.type === "user");
    if (!lastUserMsg) {
      setPopup({
        message: "No previously-submitted user message found.",
        type: "error",
      });
      return;
    }

    // We call onSubmit, passing a `messageOverride`
    onSubmit({
      message: lastUserMsg.message,
      currentMessageFiles: currentMessageFiles,
      useAgentSearch: deepResearchEnabled,
      messageIdToResend: lastUserMsg.messageId,
    });
  }

  const toggleDocumentSidebar = useCallback(() => {
    if (!documentSidebarVisible) {
      updateCurrentDocumentSidebarVisible(true);
    } else {
      updateCurrentDocumentSidebarVisible(false);
    }
  }, [documentSidebarVisible, updateCurrentDocumentSidebarVisible]);

  const toggleChatSessionSearchModal = useCallback(
    () => setIsChatSearchModalOpen((open) => !open),
    [setIsChatSearchModalOpen]
  );

  // if (!user) {
  //   redirect("/auth/login");
  // }

  const toggleDocumentSelection = useCallback((document: qilegalDocument) => {
    setSelectedDocuments((prev) =>
      prev.some((d) => d.document_id === document.document_id)
        ? prev.filter((d) => d.document_id !== document.document_id)
        : [...prev, document]
    );
  }, []);

  const handleChatInputSubmit = useCallback(() => {
    onSubmit({
      message: message,
      currentMessageFiles: currentMessageFiles,
      useAgentSearch: deepResearchEnabled,
    });
    setShowOnboarding(false);
  }, [message, onSubmit, currentMessageFiles, deepResearchEnabled]);

  // Memoized callbacks for DocumentResults
  const handleMobileDocumentSidebarClose = useCallback(() => {
    updateCurrentDocumentSidebarVisible(false);
  }, [updateCurrentDocumentSidebarVisible]);

  const handleDesktopDocumentSidebarClose = useCallback(() => {
    setTimeout(() => updateCurrentDocumentSidebarVisible(false), 300);
  }, [updateCurrentDocumentSidebarVisible]);

  // Only show the centered hero layout when there is NO project selected
  // and there are no messages yet. If a project is selected, prefer a top layout.
  const showCenteredHero = currentProjectId === null && showCenteredInput;

  useEffect(() => {
    if (currentProjectId !== null && showCenteredInput) {
      setProjectPanelVisible(true);
    }
    if (!showCenteredInput) {
      setProjectPanelVisible(false);
    }
  }, [currentProjectId, showCenteredInput]);

  // When no chat session exists but a project is selected, fetch the
  // total tokens for the project's files so upload UX can compare
  // against available context similar to session-based flows.
  const [projectContextTokenCount, setProjectContextTokenCount] = useState(0);
  // Fetch project-level token count when no chat session exists.
  // Note: useEffect cannot be async, so we define an inner async function (run)
  // and invoke it. The `cancelled` guard prevents setting state after the
  // component unmounts or when the dependencies change and a newer effect run
  // supersedes an older in-flight request.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!existingChatSessionId && currentProjectId !== null) {
        try {
          const total = await getProjectTokenCount(currentProjectId);
          if (!cancelled) setProjectContextTokenCount(total || 0);
        } catch {
          if (!cancelled) setProjectContextTokenCount(0);
        }
      } else {
        setProjectContextTokenCount(0);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [existingChatSessionId, currentProjectId, currentProjectDetails?.files]);

  // Available context tokens source of truth:
  // - If a chat session exists, fetch from session API (dynamic per session/model)
  // - If no session, derive from the default/current persona's max document tokens
  const [availableContextTokens, setAvailableContextTokens] = useState<number>(
    DEFAULT_CONTEXT_TOKENS * 0.5
  );
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (existingChatSessionId) {
          const available = await getAvailableContextTokens(
            existingChatSessionId
          );
          const capped_context_tokens =
            (available ?? DEFAULT_CONTEXT_TOKENS) * 0.5;
          if (!cancelled) setAvailableContextTokens(capped_context_tokens);
        } else {
          const personaId = (selectedAssistant || liveAssistant)?.id;
          if (personaId !== undefined && personaId !== null) {
            const maxTokens = await getMaxSelectedDocumentTokens(personaId);
            const capped_context_tokens =
              (maxTokens ?? DEFAULT_CONTEXT_TOKENS) * 0.5;
            if (!cancelled) setAvailableContextTokens(capped_context_tokens);
          } else if (!cancelled) {
            setAvailableContextTokens(DEFAULT_CONTEXT_TOKENS * 0.5);
          }
        }
      } catch (e) {
        if (!cancelled) setAvailableContextTokens(DEFAULT_CONTEXT_TOKENS * 0.5);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [existingChatSessionId, selectedAssistant?.id, liveAssistant?.id]);

  // handle error case where no assistants are available
  if (noAssistants) {
    return (
      <>
        <HealthCheckBanner />
        {/* <NoAssistantModal isAdmin={isAdmin} /> */}
      </>
    );
  }

  if (!isReady) return <QiLegalInitializingLoader />;

  return (
    <>
      <HealthCheckBanner />

      {/* ChatPopup is a custom popup that displays a admin-specified message on initial user visit.
      Only used in the EE version of the app. */}
      {popup}

      <ChatPopup />

      <ChatSearchModal
        open={isChatSearchModalOpen}
        onCloseModal={() => setIsChatSearchModalOpen(false)}
      />

      {retrievalEnabled && documentSidebarVisible && settings?.isMobile && (
        <div className="md:hidden">
          <Modal
            hideDividerForTitle
            onOutsideClick={() => updateCurrentDocumentSidebarVisible(false)}
            title="Sources"
          >
            {/* IMPORTANT: this is a memoized component, and it's very important
            for performance reasons that this stays true. MAKE SURE that all function
            props are wrapped in useCallback. */}
            <DocumentResults
              setPresentingDocument={setPresentingDocument}
              modal={true}
              closeSidebar={handleMobileDocumentSidebarClose}
              selectedDocuments={selectedDocuments}
              toggleDocumentSelection={toggleDocumentSelection}
              clearSelectedDocuments={() => setSelectedDocuments([])}
              // TODO (chris): fix
              selectedDocumentTokens={0}
              maxTokens={maxTokens}
            />
          </Modal>
        </div>
      )}

      {presentingDocument && (
        <TextView
          presentingDocument={presentingDocument}
          onClose={() => setPresentingDocument(null)}
        />
      )}

      {stackTraceModalContent && (
        <ExceptionTraceModal
          onOutsideClick={() => setStackTraceModalContent(null)}
          exceptionTrace={stackTraceModalContent}
        />
      )}

      <FederatedOAuthModal />

      <div className="flex flex-row h-full w-full">
        <div
          ref={masterFlexboxRef}
          className="flex h-full w-full overflow-x-hidden"
        >
          {documentSidebarInitialWidth !== undefined && (
            <Dropzone
              key={chatSessionId}
              onDrop={(acceptedFiles) =>
                handleMessageSpecificFileUpload(acceptedFiles)
              }
              noClick
            >
              {({ getRootProps }) => (
                <div
                  className="h-full w-full relative flex-auto min-w-0"
                  {...getRootProps()}
                >
                  <div
                    onScroll={handleScroll}
                    className="w-full h-[calc(100dvh-100px)] flex flex-col default-scrollbar overflow-y-auto overflow-x-hidden relative"
                    ref={scrollableDivRef}
                  >
                    <MessagesDisplay
                      messageHistory={messageHistory}
                      completeMessageTree={completeMessageTree}
                      liveAssistant={liveAssistant}
                      llmManager={llmManager}
                      deepResearchEnabled={deepResearchEnabled}
                      currentMessageFiles={currentMessageFiles}
                      setPresentingDocument={setPresentingDocument}
                      onSubmit={onSubmit}
                      onMessageSelection={onMessageSelection}
                      stopGenerating={stopGenerating}
                      uncaughtError={uncaughtError}
                      loadingError={loadingError}
                      handleResubmitLastMessage={handleResubmitLastMessage}
                      autoScrollEnabled={autoScrollEnabled}
                      getContainerHeight={getContainerHeight}
                      lastMessageRef={lastMessageRef}
                      endPaddingRef={endPaddingRef}
                      endDivRef={endDivRef}
                      hasPerformedInitialScroll={hasPerformedInitialScroll}
                      chatSessionId={chatSessionId}
                      enterpriseSettings={enterpriseSettings}
                      showLegacyPager={legacySearch.showLegacyPager}
                      showLegacyPagerStatutes={
                        legacySearch.showLegacyPagerStatutes
                      }
                      pager={legacySearch.pager}
                      selectedHistory={legacySearch.selectedHistory}
                      loadingPageFor={legacySearch.loadingPageFor}
                      goToPage={legacySearch.goToPage}
                      goToPageStatutes={legacySearch.goToPageStatutes}
                      pageList={legacySearch.pageList}
                    />
                  </div>

                  <div
                    ref={inputRef}
                    className={cn(
                      "absolute pointer-events-none z-10 w-full",
                      showCenteredHero
                        ? "inset-0"
                        : currentProjectId !== null && showCenteredInput
                          ? "top-0 left-0 right-0"
                          : "bottom-0 left-0 right-0 translate-y-0"
                    )}
                  >
                    {!showCenteredInput && aboveHorizon && (
                      <div className="mx-auto w-fit !pointer-events-none flex sticky justify-center">
                        <button
                          onClick={() => clientScrollToBottom()}
                          className="p-1 pointer-events-auto text-text-03 rounded-2xl bg-background-neutral-02 border border-border mx-auto"
                        >
                          <FiArrowDown size={18} />
                        </button>
                      </div>
                    )}

                    <div
                      className={cn(
                        "pointer-events-auto w-[95%] mx-auto relative text-text-04 justify-center",
                        showCenteredHero
                          ? "h-full grid grid-rows-[1fr_auto_1fr]"
                          : "mb-8"
                      )}
                    >
                      {currentProjectId == null && showCenteredInput && (
                        <WelcomeMessage liveAssistant={liveAssistant} />
                      )}
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center",
                          showCenteredHero && "row-start-2"
                        )}
                      >
                        {currentProjectId !== null && projectPanelVisible && (
                          <ProjectContextPanel
                            projectTokenCount={projectContextTokenCount}
                            availableContextTokens={availableContextTokens}
                            setPresentingDocument={setPresentingDocument}
                          />
                        )}

                        {(showOnboarding ||
                          (user?.role !== UserRole.ADMIN &&
                            !user?.personalization?.name)) &&
                          currentProjectId === null && (
                            <OnboardingFlow
                              handleHideOnboarding={() =>
                                setShowOnboarding(false)
                              }
                              state={onboardingState}
                              actions={onboardingActions}
                              llmDescriptors={llmDescriptors}
                            />
                          )}
                        <ChatInputBar
                          deepResearchEnabled={deepResearchEnabled}
                          toggleDeepResearch={toggleDeepResearch}
                          toggleDocumentSidebar={toggleDocumentSidebar}
                          filterManager={filterManager}
                          llmManager={llmManager}
                          removeDocs={() => setSelectedDocuments([])}
                          retrievalEnabled={retrievalEnabled}
                          selectedDocuments={selectedDocuments}
                          message={message}
                          setMessage={setMessage}
                          stopGenerating={stopGenerating}
                          onSubmit={handleChatInputSubmit}
                          chatState={currentChatState}
                          currentSessionFileTokenCount={
                            existingChatSessionId
                              ? currentSessionFileTokenCount
                              : projectContextTokenCount
                          }
                          availableContextTokens={availableContextTokens}
                          selectedAssistant={selectedAssistant || liveAssistant}
                          handleFileUpload={handleMessageSpecificFileUpload}
                          textAreaRef={textAreaRef}
                          setPresentingDocument={setPresentingDocument}
                          disabled={
                            llmManager.hasAnyProvider === false ||
                            onboardingState.currentStep !==
                              OnboardingStep.Complete
                          }
                          onOpenLegacySearchConfig={() =>
                            legacySearch.setShowPopup(true)
                          }
                        />
                      </div>

                      {currentProjectId !== null && (
                        <div className="transition-all duration-700 ease-out">
                          <ProjectChatSessionList />
                        </div>
                      )}

                      {liveAssistant.starter_messages &&
                        liveAssistant.starter_messages.length > 0 &&
                        messageHistory.length === 0 &&
                        showCenteredHero && (
                          <div className="mt-6 row-start-3 max-w-[50rem]">
                            <Suggestions onSubmit={onSubmit} />
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </Dropzone>
          )}
        </div>

        <div
          className={cn(
            "flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
            documentSidebarVisible && !settings?.isMobile
              ? "w-[25rem]"
              : "w-[0rem]"
          )}
        >
          <div className="h-full w-[25rem]">
            {/* IMPORTANT: this is a memoized component, and it's very important
              for performance reasons that this stays true. MAKE SURE that all function
              props are wrapped in useCallback. */}
            <DocumentResults
              setPresentingDocument={setPresentingDocument}
              modal={false}
              closeSidebar={handleDesktopDocumentSidebarClose}
              selectedDocuments={selectedDocuments}
              toggleDocumentSelection={toggleDocumentSelection}
              clearSelectedDocuments={() => setSelectedDocuments([])}
              // TODO (chris): fix
              selectedDocumentTokens={0}
              maxTokens={maxTokens}
            />
          </div>
        </div>
      </div>
      {selectedAssistant?.name === "Legacy Search" &&
        legacySearch.showPopup && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6 lg:p-12">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => {
                if (!legacySearch.isSearching) legacySearch.setShowPopup(false);
              }}
            />
            <div className="relative bg-white backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-[min(960px,92vw)] max-h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-normal text-gray-900">
                  Search Configuration
                </h3>
                <button
                  onClick={() => legacySearch.setShowPopup(false)}
                  className="text-gray-400 hover:text-gray-700 transition text-2xl leading-none ml-4"
                  title="Close"
                >
                  &times;
                </button>
              </div>

              <div className="mb-4 relative">
                <h3 className="font-normal text-gray-800">
                  Select query to refine:
                </h3>
                <p className="text-gray-500 text-sm mb-3">
                  Choose a query to apply keyword or advanced filters.
                </p>
                <div className="relative">
                  <select
                    value={legacySearch.selectedQueryId || ""}
                    onChange={(e) => {
                      legacySearch.setSelectedQueryId(e.target.value);
                      legacySearch.setIsDropdownOpen(false); // Close dropdown after selection
                    }}
                    onClick={() => legacySearch.setIsDropdownOpen(true)} // Open on click
                    onBlur={() => {
                      setTimeout(
                        () => legacySearch.setIsDropdownOpen(false),
                        150
                      ); // Close on blur with slight delay
                    }}
                    className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:outline-none appearance-none bg-white"
                  >
                    <option value="" disabled>
                      Select a previous query
                    </option>
                    {legacySearch.searchHistory
                      .filter(
                        (q) =>
                          legacySearch.pager[q.id]?.domain ===
                          legacySearch.searchDomain
                      ) // ← only current domain
                      .map((q) => {
                        const dom =
                          legacySearch.pager[q.id]?.domain === "judgements"
                            ? "Judgments"
                            : "Statutes";
                        return (
                          <option key={q.id} value={q.id}>
                            {q.query} — {dom}
                          </option>
                        );
                      })}
                  </select>

                  <div className="pointer-events-none absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 text-lg">
                    {legacySearch.isDropdownOpen ? (
                      <FiChevronUp />
                    ) : (
                      <FiChevronDown />
                    )}
                  </div>
                </div>
              </div>

              {/* Keyword Input */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-normal text-gray-800">
                    Refine your search by keyword
                  </h3>

                  {/* NEW: Match All Keywords Toggle */}
                  <label
                    className="flex items-center text-sm text-gray-600 cursor-pointer select-none hover:text-gray-900 transition-colors"
                    title="If checked, results must contain ALL keywords (Strict). If unchecked, results can contain ANY keyword (Flexible)."
                  >
                    <input
                      type="checkbox"
                      className="mr-2 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                      checked={legacySearch.keywordLogic === "AND"}
                      onChange={(e) =>
                        legacySearch.setKeywordLogic(
                          e.target.checked ? "AND" : "OR"
                        )
                      }
                    />
                    Match All Keywords
                  </label>
                </div>

                <p className="text-gray-500 text-sm">
                  Add multiple legal keywords (e.g., murder, evidence, arrest).
                  {legacySearch.keywordLogic === "OR"
                    ? " Results will match ANY of these terms."
                    : " Results must match ALL of these terms."}
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <input
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 placeholder-gray-600 text-gray-900"
                    placeholder="Enter a keyword"
                    value={legacySearch.newKeyword}
                    onChange={(e) => legacySearch.setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        legacySearch.addKeyword();
                      }
                    }}
                  />
                  <button onClick={legacySearch.addKeyword} title="Add keyword">
                    <img
                      src="/send.png"
                      alt="add"
                      className="h-8 w-8 cursor-pointer"
                    />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {legacySearch.keywords.map((item) => (
                    <div
                      key={item}
                      className="flex items-center px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-full bg-white group hover:bg-red-500 hover:text-white transition cursor-pointer"
                      onClick={() => legacySearch.removeKeyword(item)}
                    >
                      <span>{item}</span>
                      <IoMdClose className="ml-2 text-base opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Domain selector: Judgments / Statutes */}
              <div className="mb-4">
                <div
                  className="inline-flex rounded-lg border border-gray-300 overflow-hidden"
                  role="tablist"
                  aria-label="Result Type"
                >
                  <button
                    type="button"
                    onClick={() => {
                      legacySearch.setSearchDomain("judgements");
                      legacySearch.setShowAdvancedOption(false); // collapse when switching domains
                    }}
                    className={`px-4 py-2 text-sm ${
                      legacySearch.searchDomain === "judgements"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                    aria-selected={legacySearch.searchDomain === "judgements"}
                    role="tab"
                  >
                    Judgments
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      legacySearch.setSearchDomain("statutes");
                      legacySearch.setShowAdvancedOption(false); // collapse when switching domains
                    }}
                    className={`px-4 py-2 text-sm border-l border-gray-300 ${
                      legacySearch.searchDomain === "statutes"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                    aria-selected={legacySearch.searchDomain === "statutes"}
                    role="tab"
                  >
                    Statutes
                  </button>
                </div>
              </div>

              {/* Advanced Search Block (Judgments only) */}
              {legacySearch.searchDomain === "judgements" && (
                <div className="border border-gray-300 rounded-lg p-4 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      legacySearch.setShowAdvancedOption((prev) => !prev)
                    }
                    className="w-full flex justify-between items-center text-left focus:outline-none"
                  >
                    <span className="font-medium text-gray-800">
                      Advanced Search
                    </span>
                    <span className="text-gray-400">
                      {legacySearch.showAdvancedOption ? "▲" : "▼"}
                    </span>
                  </button>

                  {legacySearch.showAdvancedOption && (
                    <p className="text-sm text-gray-500 mt-3">
                      You can narrow down results by entering a judge&apos;s
                      name, case title, or selecting a date range.
                    </p>
                  )}

                  {!legacySearch.showAdvancedOption && (
                    <div className="mt-2 text-xs text-gray-500 flex flex-row flex-wrap gap-x-6 gap-y-1">
                      {legacySearch.judgeName && (
                        <span>Judge&apos;s Name: {legacySearch.judgeName}</span>
                      )}
                      {legacySearch.state[0]?.startDate &&
                        legacySearch.state[0]?.endDate && (
                          <span>
                            Date Range:{" "}
                            {legacySearch.state[0].startDate.toLocaleDateString()}{" "}
                            –{" "}
                            {legacySearch.state[0].endDate.toLocaleDateString()}
                          </span>
                        )}
                      {legacySearch.caseName && (
                        <span>Case Title: {legacySearch.caseName}</span>
                      )}
                      {legacySearch.selectedCourts.length > 0 && (
                        <span>
                          Courts:{" "}
                          {legacySearch.selectedCourts.length > 3
                            ? `${legacySearch.selectedCourts
                                .slice(0, 3)
                                .join(", ")} +${
                                legacySearch.selectedCourts.length - 3
                              } more`
                            : legacySearch.selectedCourts.join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  {legacySearch.showAdvancedOption && (
                    <>
                      <hr className="border-gray-300 my-4" />
                      <div className="grid grid-cols-2 gap-8 mb-4">
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">
                            Judge&apos;s Name:
                          </label>
                          <input
                            type="text"
                            value={legacySearch.judgeName}
                            onChange={(e) =>
                              legacySearch.setJudgeName(e.target.value)
                            }
                            className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 placeholder-gray-300 text-gray-700"
                            placeholder="Enter judge's name"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">
                            Date:
                          </label>
                          <div className="flex items-center gap-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <input
                                    type="text"
                                    readOnly
                                    value={
                                      legacySearch.state[0]?.startDate &&
                                      legacySearch.state[0]?.endDate
                                        ? `${format(
                                            legacySearch.state[0].startDate,
                                            "PPP"
                                          )} - ${format(
                                            legacySearch.state[0].endDate,
                                            "PPP"
                                          )}`
                                        : ""
                                    }
                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 placeholder-gray-300 text-gray-700 cursor-not-allowed"
                                    placeholder="Select date range"
                                  />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="text-sm font-medium text-white bg-gray-800 px-3 py-2 rounded shadow-lg"
                                >
                                  You can&apos;t edit this manually. Use the
                                  calendar picker.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <button onClick={legacySearch.toggleDatePopup}>
                              <img
                                src="/Calendar.png"
                                alt="select date"
                                className="h-6"
                              />
                            </button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => {
                                      legacySearch.setState([
                                        {
                                          startDate: null,
                                          endDate: null,
                                          key: "selection",
                                        },
                                      ]);
                                      legacySearch.setJudgeName("");
                                      legacySearch.setCaseName("");
                                      legacySearch.setSelectedCourts([]); // keep empty (no SC, no HC)
                                    }}
                                    className="text-sm text-gray-500 underline"
                                  >
                                    Clear
                                  </button>
                                </TooltipTrigger>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        <div className="col-span-2 flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">
                            Case Title:
                          </label>
                          <input
                            type="text"
                            value={legacySearch.caseName}
                            onChange={(e) =>
                              legacySearch.setCaseName(e.target.value)
                            }
                            className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 placeholder-gray-300 text-gray-700"
                            placeholder="Enter case title"
                          />
                        </div>
                      </div>

                      {/* Courts */}
                      <hr className="border-gray-300 my-4" />
                      <div className="mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          Courts:
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Select Supreme Court and/or one or more High Courts.
                          Leave all unchecked if you don’t want to constrain by
                          court.
                        </p>

                        <div className="rounded-lg border border-gray-200 p-3">
                          {/* --- Select All Courts Checkbox --- */}
                          <div className="flex items-center mb-2 border-b border-gray-100 pb-2">
                            <input
                              id="select-all-courts"
                              type="checkbox"
                              className="mr-2 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                              checked={legacySearch.isAllCourtsSelected}
                              onChange={legacySearch.toggleAllCourts}
                            />
                            <label
                              htmlFor="select-all-courts"
                              className="text-sm font-semibold text-gray-800"
                            >
                              Select All (Supreme Court + High Courts)
                            </label>
                          </div>
                          {/* Supreme Court */}
                          <div className="flex items-center mb-2">
                            <input
                              id="sc"
                              type="checkbox"
                              className="mr-2"
                              checked={legacySearch.isCourtChecked(
                                "Supreme Court"
                              )}
                              onChange={() =>
                                legacySearch.toggleCourt("Supreme Court")
                              }
                            />
                            <label
                              htmlFor="sc"
                              className="text-sm text-gray-700"
                            >
                              Supreme Court
                            </label>
                          </div>

                          {/* High Courts */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2">
                            {legacySearch.loadingCourts &&
                              legacySearch.courtsList.length === 0 && (
                                <span className="text-xs text-gray-500 col-span-full">
                                  Loading courts…
                                </span>
                              )}
                            {!legacySearch.loadingCourts &&
                              legacySearch.courtsList.map((c) => (
                                <label
                                  key={c}
                                  className="inline-flex items-center text-sm text-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="mr-2"
                                    checked={legacySearch.isCourtChecked(c)}
                                    onChange={() => legacySearch.toggleCourt(c)}
                                  />
                                  {c}
                                </label>
                              ))}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Tip: leave everything unchecked to default to Supreme
                          Court.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Advanced Search Block (Statutes only) */}
              {legacySearch.searchDomain === "statutes" && (
                <div className="border border-gray-300 rounded-lg p-4 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      legacySearch.setShowAdvancedOption((prev) => !prev)
                    }
                    className="w-full flex justify-between items-center text-left focus:outline-none"
                  >
                    <span className="font-medium text-gray-800">
                      Advanced Search
                    </span>
                    <span className="text-gray-400">
                      {legacySearch.showAdvancedOption ? "▲" : "▼"}
                    </span>
                  </button>

                  {!legacySearch.showAdvancedOption && (
                    <div className="mt-2 text-xs text-gray-500 flex flex-row flex-wrap gap-x-6 gap-y-1">
                      {legacySearch.sectionTitle && (
                        <span>
                          Search within Section Title: “
                          {legacySearch.sectionTitle}”
                        </span>
                      )}
                      {legacySearch.selectedStatutes.length > 0 && (
                        <span>
                          Sources:{" "}
                          {legacySearch.selectedStatutes.length > 3
                            ? `${legacySearch.selectedStatutes
                                .slice(0, 3)
                                .join(", ")} +${
                                legacySearch.selectedStatutes.length - 3
                              } more`
                            : legacySearch.selectedStatutes.join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  {legacySearch.showAdvancedOption && (
                    <>
                      <p className="text-sm text-gray-500 mt-3">
                        “Search within Section Title” restricts matches to
                        section titles of the selected sources.
                      </p>

                      <hr className="border-gray-300 my-4" />
                      <div className="grid grid-cols-1 gap-6 mb-4">
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">
                            Search within Section Title:
                          </label>
                          <input
                            type="text"
                            value={legacySearch.sectionTitle}
                            onChange={(e) =>
                              legacySearch.setSectionTitle(e.target.value)
                            }
                            className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 placeholder-gray-300 text-gray-700"
                            placeholder="Enter Section Title"
                          />
                        </div>
                      </div>

                      {/* Sources: Central Acts + States */}
                      <hr className="border-gray-300 my-4" />
                      <div className="mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          Sources:
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Select at least one source: “Central Acts” and/or one
                          or more States.
                        </p>

                        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                          {/* --- Select All Sources Checkbox --- */}
                          <div className="flex items-center border-b border-gray-100 pb-2">
                            <input
                              id="select-all-statutes"
                              type="checkbox"
                              className="mr-2 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                              checked={legacySearch.isAllStatutesSelected}
                              onChange={legacySearch.toggleAllStatutes}
                            />
                            <label
                              htmlFor="select-all-statutes"
                              className="text-sm font-semibold text-gray-800"
                            >
                              Select All (Central Acts + States)
                            </label>
                          </div>
                          {/* Central Acts */}
                          <div className="flex items-center">
                            <input
                              id="central-acts"
                              type="checkbox"
                              className="mr-2"
                              checked={legacySearch.isStatuteChecked(
                                "Central Acts"
                              )}
                              onChange={() =>
                                legacySearch.toggleStatute("Central Acts")
                              }
                            />
                            <label
                              htmlFor="central-acts"
                              className="text-sm text-gray-700"
                            >
                              Central Acts
                            </label>
                          </div>

                          {/* States */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2">
                            {legacySearch.loadingStates &&
                              legacySearch.statesList.length === 0 && (
                                <span className="text-xs text-gray-500 col-span-full">
                                  Loading states…
                                </span>
                              )}
                            {!legacySearch.loadingStates &&
                              legacySearch.statesList.map((s) => (
                                <label
                                  key={s}
                                  className="inline-flex items-center text-sm text-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="mr-2"
                                    checked={legacySearch.isStatuteChecked(s)}
                                    onChange={() =>
                                      legacySearch.toggleStatute(s)
                                    }
                                  />
                                  {s}
                                </label>
                              ))}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Tip: leave everything unchecked to default to Central
                          Acts.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => legacySearch.setShowClearConfirm(true)}
                  disabled={legacySearch.isSearching}
                  className={`py-3 px-6 rounded-lg font-medium border transition
${
  legacySearch.isSearching
    ? "bg-gray-200 text-gray-400 cursor-not-allowed border-gray-200"
    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
}`}
                  title="Clear all refine/advanced fields and selected courts/sources"
                >
                  Clear
                </button>
                <button
                  onClick={legacySearch.applyConfiguration}
                  // FIX: Disable if searching OR if no history exists (user hasn't queried yet)
                  disabled={
                    legacySearch.isSearching ||
                    legacySearch.searchHistory.length === 0
                  }
                  className={`py-3 px-6 rounded-lg font-medium transition
                  ${
                    // FIX: Apply disabled styling if searching OR if history is empty
                    legacySearch.isSearching ||
                    legacySearch.searchHistory.length === 0
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-gray-900 hover:bg-gray-800 text-white"
                  }`}
                  // FIX: Update title to explain why it might be disabled
                  title={
                    legacySearch.searchHistory.length === 0
                      ? "Please perform a search query first"
                      : "Apply refine keywords and advanced filters"
                  }
                >
                  {legacySearch.isSearching ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                      Retrieving…
                    </span>
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>

              {legacySearch.lastAppliedSummary && !legacySearch.isSearching && (
                <p className="mt-3 text-xs text-gray-600">
                  Applied: {legacySearch.lastAppliedSummary}
                </p>
              )}
            </div>
          </div>
        )}
      {legacySearch.isSearching && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
          <div className="relative z-[61] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border border-gray-200 bg-white">
            <span className="inline-block h-5 w-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
            <span className="text-sm text-gray-700">Retrieving results…</span>
          </div>
        </div>
      )}

      {legacySearch.showDatePopup && (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={legacySearch.toggleDatePopup}
          />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white p-6 rounded-2xl shadow-2xl border border-gray-200 w-[520px] max-w-[92vw]">
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-1">
                      Select Date Range
                    </h2>
                    <p className="text-sm text-gray-500">
                      Filter judgments within a custom date range.
                    </p>
                  </div>
                  <button
                    onClick={legacySearch.toggleDatePopup}
                    className="text-gray-400 hover:text-gray-700 transition text-2xl leading-none ml-4"
                    title="Close"
                  >
                    &times;
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <DatePicker
                    label="Start Date"
                    value={legacySearch.currentRange.startDate}
                    onChange={(date: Date | null) => {
                      legacySearch.setState([
                        { ...legacySearch.currentRange, startDate: date },
                      ]);
                    }}
                    slotProps={{
                      textField: { size: "small", fullWidth: true },
                    }}
                  />

                  <DatePicker
                    label="End Date"
                    value={legacySearch.currentRange.endDate}
                    minDate={legacySearch.currentRange.startDate || undefined}
                    onChange={(date: Date | null) => {
                      legacySearch.setState([
                        { ...legacySearch.currentRange, endDate: date },
                      ]);
                    }}
                    slotProps={{
                      textField: { size: "small", fullWidth: true },
                    }}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      legacySearch.setState([
                        { startDate: null, endDate: null, key: "selection" },
                      ]);
                    }}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </LocalizationProvider>
            </div>
          </div>
        </div>
      )}

      {legacySearch.showScopeWarn && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={legacySearch.cancelCourtChange}
          />
          <div className="relative z-[71] bg-white rounded-2xl shadow-2xl border border-gray-200 w-[560px] max-w-[92vw] p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Changing courts may invalidate filters
            </h4>
            <p className="text-sm text-gray-700 mb-6">
              {legacySearch.scopeWarnText}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={legacySearch.acceptCourtChangeClear}
                className="w-full px-3 py-2 rounded-md text-sm bg-gray-900 text-white hover:bg-gray-800"
              >
                Clear filters & keep new courts
              </button>
              <button
                onClick={legacySearch.acceptCourtChangeKeep}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 text-gray-800 hover:bg-gray-50"
              >
                Keep filters anyway
              </button>
              <button
                onClick={legacySearch.cancelCourtChange}
                className="w-full px-3 py-2 rounded-md text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {legacySearch.showStatutesScopeWarn && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4 sm:p-6 lg:p-12">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={legacySearch.cancelStatutesChange}
          />
          <div className="relative bg-white backdrop-blur-lg rounded-2xl shadow-2xl p-6 w-[min(560px,92vw)]">
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              Changing sources may invalidate filters
            </h3>
            <p className="text-sm text-gray-700 mb-5">
              {legacySearch.statutesScopeWarnText}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={legacySearch.cancelStatutesChange}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={legacySearch.acceptStatutesChangeKeep}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 bg-white hover:bg-gray-50"
              >
                Switch & keep filters
              </button>
              <button
                onClick={legacySearch.acceptStatutesChangeClear}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
              >
                Switch & clear filters
              </button>
            </div>
          </div>
        </div>
      )}
      {legacySearch.showClearConfirm && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => legacySearch.setShowClearConfirm(false)}
          />
          <div className="relative z-[76] bg-white rounded-2xl shadow-2xl border border-gray-200 w-[520px] max-w-[92vw] p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Clear all refine & advanced fields?
            </h4>
            <p className="text-sm text-gray-700 mb-6">
              You’re about to clear <strong>Refine Search</strong> keywords and{" "}
              <strong>Advanced Filters</strong>. This won’t delete your past
              search results or history.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  legacySearch.clearAllConfigFields();
                  legacySearch.setShowClearConfirm(false);
                }}
                className="w-full px-3 py-2 rounded-md text-sm bg-gray-900 text-white hover:bg-gray-800"
              >
                Yes, clear everything
              </button>
              <button
                onClick={() => legacySearch.setShowClearConfirm(false)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gauge Meter Overlay */}
      {/* ---------------- COMMENT OUT UI START ----------------
      {liveAssistant?.name === "Case Analysis" && hasCaseAnalysisStarted && (
        <div
          className="fixed bottom-4 right-4 z-30 flex justify-end"
          style={{
            width: "140px",
            transition: "width 0.2s ease-in-out",
          }}
        >
          <GaugeMeter value={caseAnalysisConfidence ?? 0} />
        </div>
      )}
      ---------------- COMMENT OUT UI END ---------------- */}
    </>
  );
}
