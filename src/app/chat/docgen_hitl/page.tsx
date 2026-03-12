"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import {
  FaTrashAlt,
  FaPlus,
  FaRegCopy,
  FaCheck,
  FaStop,
  FaPlay,
  FaExclamationTriangle,
} from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { FadeLoader } from "react-spinners";
import Cookies from "js-cookie";
import { SIDEBAR_TOGGLED_COOKIE_NAME } from "@/components/resizable/constants";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const Toast = ({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  onClose: () => void;
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const styles = {
    success: "bg-green-600",
    error: "bg-red-600",
    warning: "bg-yellow-500 text-black",
    info: "bg-blue-600",
  };


  return (
    <div
      className={`fixed top-6 right-6 z-[999] transition-all duration-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
        }`}
    >
      <div
        className={`flex items-center gap-4 px-4 py-2 rounded-xl shadow-xl text-white text-sm font-medium ${styles[type]} backdrop-blur-md`}
      >
        <span className="flex items-center gap-2">
          {type === "success" && <FaCheck />}
          {type === "error" && <FaExclamationTriangle />}
          {type === "warning" && <FaExclamationTriangle />}
          {type === "info" && <FaPlay />}
          {message}
        </span>

        <button
          onClick={handleClose}
          className="ml-2 text-white/80 hover:text-white bg-black pl-4 pr-4 pt-3 pb-3 rounded-full transition"
        > Dismiss
        </button>
      </div>
    </div>
  );
};

const Page: React.FC = () => {
  // State for document type and description
  const router = useRouter();
  const [documentType, setDocumentType] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");

  const [mergedDocument, setMergedDocument] = useState(""); // For the merged document
  const [showMergeButton, setShowMergeButton] = useState(false); // To control the visibility of the button

  // State for titles, save and generated document
  const [titles, setTitles] = useState<string[]>([]);
  const [modifiedTitles, setModifiedTitles] = useState<string[]>([]);
  const [generatedDocument, setGeneratedDocument] = useState<
    { title: string; content: string }[]
  >([]);
  const [editableContentIndexes, setEditableContentIndexes] = useState<
    number[]
  >([]);
  const [areTitlesSaved, setAreTitlesSaved] = useState(false); // Track if titles are saved

  // State for managing loading and progress
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("Initializing...");
  const [error, setError] = useState("");
  // For Toast Component
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // For Cancel Disabled button
  const [isCancelDisabled, setIsCancelDisabled] = useState(false);

  // Tracks which title inputs are editable
  const [editableIndexes, setEditableIndexes] = useState<number[]>([]);

  const [mergeNotification, setMergeNotification] = useState(false); // State for merge notification

  const documentSectionsRef = useRef<HTMLDivElement | null>(null); // Reference for document sections
  const generatedDocumentRef = useRef<HTMLDivElement | null>(null); // Reference for generated document
  const [isFetchingSections, setIsFetchingSections] = useState(false);
  const [isFetchingGeneratedDocument, setIsFetchingGeneratedDocument] =
    useState(false);
  const sectionAbortController = useRef<AbortController | null>(null);
  const documentAbortController = useRef<AbortController | null>(null);
  const [actionState, setActionState] = useState("start");
  const [isBeginDisabled, setIsBeginDisabled] = useState(false);
  const [mergedTitles, setMergedTitles] = useState(""); // For merged titles

  const [generationCompleted, setGenerationCompleted] = useState(false);
  const [documentSubtype, setDocumentSubtype] = useState("");

  const [showDocSidebar, setShowDocSidebar] = useState(false);
  const [untoggled, setUntoggled] = useState(false);
  const sidebarElementRef = useRef<HTMLDivElement>(null);
  const innerSidebarElementRef = useRef<HTMLDivElement>(null);

  const [copiedStatus, setCopiedStatus] = useState<
    Record<number, { title?: boolean; content?: boolean }>
  >({});
  const documentSubtypes: Record<string, string[]> = {
  "NDA": ["Mutual NDA", "One-way NDA", "Employee NDA", "Vendor NDA"],
  "Loan Agreement": ["Secured Loan", "Unsecured Loan", "Personal Loan"],
  "Employment Contract": ["Full-time", "Part-time", "Consultant"],
  "Lease Agreement": ["Residential Lease", "Commercial Lease"],
};
  const handleCopy = (
    text: string,
    index: number,
    field: "title" | "content"
  ) => {
    // Fallback for unsupported Clipboard API
    const fallbackCopy = (textToCopy: string) => {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.style.position = "fixed"; // Avoid scrolling to the textarea
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    };

    // Try Clipboard API or fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedStatus((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: true },
        }));
        setToastMessage(`${field === "title" ? "Title" : "Content"} copied successfully!`);
        setTimeout(() => {
          setCopiedStatus((prev) => ({
            ...prev,
            [index]: { ...prev[index], [field]: false },
          }));
        }, 2000); // Revert after 2 seconds
      });
    } else {
      fallbackCopy(text);
      setCopiedStatus((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: true },
      }));
      setTimeout(() => {
        setCopiedStatus((prev) => ({
          ...prev,
          [index]: { ...prev[index], [field]: false },
        }));
      }, 2000);
    }
  };

  // API base URL
  // const API_BASE_URL = "http://13.202.103.72:8002";
  const API_BASE_URL = "/api/docgen_hitl";

  // Poll backend for progress updates
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isLoading) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/get_progress`);
          setProgressMessage(response.data.status || "Fetching progress...");
        } catch {
          setProgressMessage("Fetching progress...");
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  useEffect(() => {
    if (generatedDocument.length > 0 && generationCompleted) {
      setShowMergeButton(true);
    }
  }, [generationCompleted, generatedDocument]);

  // Handle "Init Document Generation"
  const handleInitDocument = async () => {
    if (actionState === "start") {
      setActionState("stop");
      setIsCancelDisabled(true); // Disable the "Clear All" button
      setError(""); // Clear previous errors
      setTitles([]); // Reset titles
      setModifiedTitles([]); // Reset modified titles

      // Clear previous generation results instantly
      setGeneratedDocument([]);
      setMergedDocument("");
      setMergedTitles("");
      setShowMergeButton(false);
      setGenerationCompleted(false);

      setProgressMessage("Initializing document generation...");
      setIsFetchingSections(true);

      if (!documentType || !documentDescription) {
        setError("Document type and description are required.");
        setActionState("start"); // Revert the state if validation fails
        setIsCancelDisabled(false); // Re-enable "Clear All"
        return;
      }
      if (documentSubtypes[documentType] && !documentSubtype) {
  setToastMessage("Please select document subtype");
  setActionState("start");
  setIsCancelDisabled(false);
  return;
}

      sectionAbortController.current = new AbortController();
      const { signal } = sectionAbortController.current;

      setIsLoading(true);

      setTimeout(() => {
        const mockTitles = [
          "Parties",
          "Definitions",
          "Loan Details",
          "Security Interest",
          "Repayment Terms",
          "Events of Default",
          "Governing Law",
          "Signatures"
        ];

        setTitles(mockTitles);
        setModifiedTitles(mockTitles);
        setIsFetchingSections(false);
        setIsLoading(false);
        setActionState("start");
        setIsCancelDisabled(false);
      }, 1000);
    } else {
      setActionState("start");
      if (sectionAbortController.current) {
        sectionAbortController.current.abort();
      }
      setIsFetchingSections(false);
      setIsLoading(false);
      setProgressMessage("Process stopped.");
      setIsCancelDisabled(false); // Re-enable "Clear All" button
    }
  };

  // Handle "Clear"
  const handleClear = () => {
    if (isCancelDisabled) return; // Prevent cancel button from working when disabled
    setDocumentType("");
    setDocumentDescription("");
    setDocumentSubtype("");
    setTitles([]);
    setModifiedTitles([]);
    setGeneratedDocument([]);
    setMergedDocument(""); // Clear merged document
    setMergedTitles(""); // Clear merged titles
    setShowMergeButton(false); // Hide the merge button
    setError("");
    setProgressMessage("");
    setIsCancelDisabled(false); // Re-enable the cancel button
  };

  const handleMerge = () => {
    const mergedContent = generatedDocument
      .map(({ title, content }) => `${title}\n\n${content}`)
      .join("\n\n--------------------------------------\n\n");
    setMergedDocument(mergedContent);

    // Show the merge notification
    setMergeNotification(true);

    // Automatically hide the notification after 3 seconds
    setTimeout(() => setMergeNotification(false), 3000);
  };

  const explicitlyUntoggle = () => {
    setShowDocSidebar(false);
    setUntoggled(true);
    setTimeout(() => setUntoggled(false), 200);
  };

  const toggleSidebar = () => {
    Cookies.set(
      SIDEBAR_TOGGLED_COOKIE_NAME,
      String(!showDocSidebar).toLocaleLowerCase()
    );
    setShowDocSidebar(!showDocSidebar);
  };

  const removeToggle = () => {
    setShowDocSidebar(false);
  };

  // useSidebarVisibility({
  //     toggledSidebar: showDocSidebar,
  //     sidebarElementRef,
  //     showDocSidebar,
  //     setShowDocSidebar,
  //     setToggled: removeToggle,
  //     mobile: false, // Adjust based on your app's mobile settings
  // });

  const handleMergeTitles = () => {
    const mergedContent = generatedDocument
      .map(({ title }) => title) // Only include titles
      .join("\n\n"); // Use double line breaks instead of separators
    setMergedTitles(mergedContent);

    // Show a notification similar to the merge notification for titles
    setMergeNotification(true);
    setTimeout(() => setMergeNotification(false), 3000); // Auto-hide after 3 seconds
  };

  const handleStopFetchingSections = () => {
    if (sectionAbortController.current) {
      sectionAbortController.current.abort();
      setIsFetchingSections(false); // Stop fetching
    }
  };

  // Add this inside handleStopFetchingGeneratedDocument function
  const handleStopFetchingGeneratedDocument = () => {
    if (documentAbortController.current) {
      documentAbortController.current.abort(); // Abort the request
      setIsFetchingGeneratedDocument(false); // Stop fetching state
      setProgressMessage("Document Generation Stopped"); // Feedback to user
      setIsLoading(false); // Ensure loading spinner stops
      setIsBeginDisabled(false); // Enable "Begin (1/2)" button
    }
  };

  // Handle title modification
  const handleTitleChange = (index: number, newTitle: string) => {
    const updatedTitles = [...modifiedTitles];
    updatedTitles[index] = newTitle;
    setModifiedTitles(updatedTitles);
    setAreTitlesSaved(false); // Reset the saved state when titles are modified
  };

  // Handle "Proceed to Document Generation"
  const handleGenerateDocument = async () => {
    if (modifiedTitles.some((title) => title.trim() === "")) {
      setToastMessage("Please ensure all titles are filled before proceeding."); // Show toast notification
      return;
    }

    setError("");
    setIsFetchingGeneratedDocument(true);
    setIsLoading(true);
    setIsCancelDisabled(true); // Disable the cancel button
    setIsBeginDisabled(true); // Disable "Begin (1/2)" button during the process
    setProgressMessage("Processing document generation...");

    documentAbortController.current = new AbortController();
    const { signal } = documentAbortController.current;

    setTimeout(() => {
      const mockGenerated = modifiedTitles.map((title, index) => ({
        title,
        content: `This is autogenerated content for "${title}".

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Section Number: ${index + 1}

The borrower agrees to the terms defined in this section.
All obligations shall be governed by applicable law.
`
      }));

      setGeneratedDocument(mockGenerated);

      setProgressMessage("Document generation completed.");
      setGenerationCompleted(true);

      setTimeout(() => {
        setGenerationCompleted(false);
        setIsBeginDisabled(false);
      }, 4000);

      setIsFetchingGeneratedDocument(false);
      setIsLoading(false);
      setIsCancelDisabled(false);

    }, 1500);
  };

  return (
    <>
      {/* <div className="flex items-center justify-center min-h-screen bg-[#fafafa] dark:bg-gray-900"> */}
      <div className="w-full min-h-screen bg-[#fafafa] dark:bg-[#19191E] px-10 py-8 overflow-y-auto">
        {/* Toast Component */}
        {toastMessage && (
          <Toast
            message={toastMessage}
            type="success"
            onClose={() => setToastMessage(null)}
          />
        )}


        {/* <div className="w-full max-w-7xl p-16 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg shadow-lg"> */}
        {generationCompleted && (
          <div
            className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-lg font-medium px-8 py-4 rounded-md shadow-xl transition-transform transition-opacity duration-500 ease-out opacity-100 scale-100"
            style={{
              animation: "fadeSlideInOut 3s forwards",
            }}
          >
            Document Generation Completed!
          </div>
        )}

        {/* Merge Notification */}
        {mergeNotification && (
          <div
            className="fixed top-6 right-6 z-[999] bg-green-600 text-white text-sm font-medium px-6 py-3 rounded-xl shadow-xl transition-all duration-300"
          >
            ✔ Titles and contents have been successfully merged!
          </div>
        )}
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white">
            HITL Document Generation System
         </h1>
        </div>

{/* Document Type and Description */}
<div className="mb-8">
  <label className="block text-lg font-medium mb-2">
    Document Type---
  </label>
<select
  value={documentType}
  onChange={(e) => {
    setDocumentType(e.target.value);
    setDocumentSubtype("");
  }}
  className="w-full p-3 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg focus:outline-none hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white"
>
  <option value="">Select Document Type</option>

  {Object.keys(documentSubtypes).map((type) => (
    <option key={type} value={type}>
      {type}
    </option>
  ))}
</select>

  {documentSubtypes[documentType] && (
    <>
      <label className="block text-lg font-medium mt-6 mb-2">
        Document Subtype
      </label>

      <select
        value={documentSubtype}
        onChange={(e) => setDocumentSubtype(e.target.value)}
        className="w-full p-3 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg focus:outline-none hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white"
      >
        <option value="">Select subtype</option>

        {documentSubtypes[documentType].map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </>
  )}
          <label className="block text-lg font-medium mt-6 mb-2">
            Description
          </label>
          <textarea
            value={documentDescription}
            onChange={(e) => {
              setDocumentDescription(e.target.value);
              e.target.style.height = "auto"; // Reset height
              e.target.style.height = `${e.target.scrollHeight}px`; // Set new height based on scroll
            }}
            className="w-full p-3 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg focus:outline-none hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white resize-none overflow-hidden" rows={5}
          />

          <div className="mt-6 flex justify-between">
            <button
              onClick={handleInitDocument}
              disabled={isBeginDisabled} // Disable based on state
              className={`px-4 py-2 text-white rounded-lg shadow-md focus:outline-none ${isBeginDisabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : isLoading
                    ? "bg-red-500"
                    : "bg-blue-500"
                }`}
              title={
                isBeginDisabled
                  ? "Disabled during Finalize (2/2) or generation process"
                  : "Begin Document Generation"
              }
            >
              {actionState === "start" ? (
                <>
                  <FaPlay className="inline-block mr-2" />
                  Begin (1/2)
                </>
              ) : (
                <>
                  <FaStop className="inline-block mr-2" />
                  Stop
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isCancelDisabled} // Ensure button is disabled when `isCancelDisabled` is true
              className={`px-4 py-2 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 ${isCancelDisabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-red-500 text-white hover:bg-red-600"
                }`}
              title={
                isCancelDisabled
                  ? "Disabled during document generation"
                  : "Clear all inputs"
              } // Change tooltip dynamically
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Titles Section */}
        {titles.length > 0 && (
          <div ref={documentSectionsRef} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Document Sections</h2>
            {modifiedTitles.map((title, index) => (
              <div key={index} className="mb-3 flex items-center">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    if (editableIndexes.includes(index)) {
                      handleTitleChange(index, e.target.value);
                    } else {
                      setToastMessage(
                        "Please click the edit icon to modify the title."
                      );
                    }
                  }}
                  className={`w-full p-3 border rounded-lg mr-3 font-medium 
bg-white dark:bg-[#3B3B3B] text-black dark:text-white
${editableIndexes.includes(index)
                      ? "border-gray-300 dark:border-transparent"
                      : "border-gray-200 dark:border-transparent bg-gray-100 dark:bg-[#3B3B3B] cursor-not-allowed"
                    }`}
                  readOnly={!editableIndexes.includes(index)} // Disable editing if not in editableIndexes
                  onClick={() => {
                    if (!editableIndexes.includes(index)) {
                      setToastMessage(
                        "Please click the edit icon to modify the title."
                      );
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!editableIndexes.includes(index)) {
                      setEditableIndexes((prev) => [...prev, index]);
                    }
                  }}
                  className="text-black dark:text-white hover:text-gray-300 hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center mr-3"
                  aria-label={`Edit title ${index + 1}`}
                  title="Edit the Titles"
                >
                  <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const updatedTitles = [...modifiedTitles];
                    updatedTitles.splice(index, 1); // Remove the title
                    setModifiedTitles(updatedTitles);

                    // Update state for unsaved changes
                    setAreTitlesSaved(false);

                    // Remove the index from editableIndexes
                    setEditableIndexes((prev) =>
                      prev.filter((i) => i !== index)
                    );
                  }}
                  className="text-red-500 hover:text-red-700 flex items-center justify-center mr-3"
                  aria-label="Remove Title"
                >
                  <FaTrashAlt className="w-4 h-4 text-black dark:text-white hover:text-gray-500" />
                </button>
                <div aria-live="polite" aria-atomic="true">
                  <button
                    onClick={() => handleCopy(title, index, "title")}
                    className={`${copiedStatus[index]?.title
                        ? "text-black-500"
                        : "text-black-500"
                      } hover:text-gray-700 flex items-center justify-center mr-3`}
                    aria-label="Copy Title"
                    title="Copy the Title"
                  >
                    {copiedStatus[index]?.title ? (
                      <FaCheck className="w-4 h-4 text-black dark:text-white hover:text-gray-500" />
                    ) : (
                      <FaRegCopy className="w-4 h-4 text-black dark:text-white hover:text-gray-500" />
                    )}
                  </button>
                </div>

                {index === modifiedTitles.length - 1 && ( // Add icon for the last input
                  <button
                    onClick={() => {
                      const updatedTitles = [...modifiedTitles, ""]; // Add an empty title
                      setModifiedTitles(updatedTitles);
                      setAreTitlesSaved(false); // Mark titles as unsaved
                    }}
                    className="text-green-500 hover:text-green-700 flex items-center justify-center"
                    aria-label="Add Title"
                  >
                    <FaPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-between mt-4">
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    setIsCancelDisabled(true);

                    setTimeout(() => {
                      setAreTitlesSaved(true);
                      setToastMessage("Titles saved successfully!");
                      setIsLoading(false);
                      setIsCancelDisabled(false);
                    }, 800);

                  } catch {
                    setToastMessage("Failed to save titles. Please try again.");
                  } finally {
                    setTimeout(() => setToastMessage(null), 3000);
                  }
                }}
                disabled={isLoading || areTitlesSaved}
                className={`px-4 py-2 ${areTitlesSaved
                    ? "bg-green-500 text-white cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                  } rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 ease-in-out transform hover:scale-105`}
                onMouseEnter={() =>
                  !areTitlesSaved &&
                  setProgressMessage(
                    "Save the titles before proceeding to document generation."
                  )
                }
                onMouseLeave={() => setProgressMessage("")}
              >
                {isLoading ? (
                  <div className="flex items-left">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z"
                      ></path>
                    </svg>
                    Processing your Request...
                  </div>
                ) : areTitlesSaved ? (
                  "Titles Saved!"
                ) : (
                  "Save Titles"
                )}
              </button>

              <button
                onClick={() => {
                  if (isFetchingGeneratedDocument) {
                    handleStopFetchingGeneratedDocument(); // Invoke stop fetching logic
                  } else {
                    if (!areTitlesSaved) {
                      setToastMessage(
                        "Please save the titles before proceeding to document generation."
                      );
                      return;
                    }
                    handleGenerateDocument(); // Start generation process
                  }
                }}
                className={`px-4 py-2 text-white rounded-lg shadow-md focus:outline-none ${isFetchingGeneratedDocument ? "bg-red-500" : "bg-green-500"
                  } hover:bg-green-600`}
              >
                {isFetchingGeneratedDocument ? (
                  <>
                    <FaStop className="inline-block mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <FaPlay className="inline-block mr-2" />
                    Finalize (2/2)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Generated Document Section */}
        {generatedDocument.length > 0 && (
          <div ref={generatedDocumentRef}>
            <h2 className="text-xl font-semibold mb-4">Generated Document</h2>
            {generatedDocument.map((section, index) => (
              <div key={index} className="mb-6">
                {/* Editable Title */}
                <label className="block text-sm font-medium mb-2">
                  Title
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => {
                      const updatedDocument = [...generatedDocument];
                      if (updatedDocument[index]) {
                        updatedDocument[index].title = e.target.value;
                        setGeneratedDocument(updatedDocument);
                      }
                    }}
                    className="w-full p-3 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg mr-9 font-bold hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white" />
                  <button
                    onClick={() => {
                      handleCopy(section.title, index, "title");
                    }} // Copy title text
                    className={`${copiedStatus[index]?.title
                        ? "text-black-500"
                        : "text-black-500"
                      } hover:text-gray-700 flex items-center justify-center`}
                    aria-label="Copy Title"
                    title="Copy Title"
                  >
                    {copiedStatus[index]?.title ? (
                      <FaCheck className="w-4 h-4" />
                    ) : (
                      <FaRegCopy className="w-4 h-4" />
                    )}
                  </button>
                  <div aria-live="polite" aria-atomic="true"></div>
                </div>

                {/* Editable Content */}
                <label className="block text-sm font-medium mb-2 mt-4">
                  Content
                </label>
                <div className="flex items-center">
                  <div className="w-full mr-3">
                    {editableContentIndexes.includes(index) ? (
                      <textarea
                        value={section.content}
                        onChange={(e) => {
                          const updatedDocument = [...generatedDocument];
                          if (updatedDocument[index]) {
                            updatedDocument[index].content = e.target.value; // <--- Fixed to .content
                            setGeneratedDocument(updatedDocument);
                          }
                        }}
                        className="w-full p-4 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white" rows={6}
                      />
                    ) : (
                      <div className="prose dark:prose-invert max-w-none w-full p-4 border border-gray-300 dark:border-transparent rounded-lg bg-white dark:bg-[#3B3B3B] text-black dark:text-white hover:border-black dark:hover:border-white">
                        <ReactMarkdown>{section.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      handleCopy(section.content, index, "content");
                    }} // Copy content text
                    className={`${copiedStatus[index]?.content
                        ? "text-black-500"
                        : "text-black-500"
                      } hover:text-gray-700 flex items-center justify-center`}
                    aria-label="Copy Content"
                    title="Copy Content"
                  >
                    {copiedStatus[index]?.content ? (
                      <FaCheck className="w-4 h-4" />
                    ) : (
                      <FaRegCopy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (editableContentIndexes.includes(index)) {
                        setEditableContentIndexes((prev) =>
                          prev.filter((i) => i !== index)
                        );
                      } else {
                        setEditableContentIndexes((prev) => [...prev, index]);
                      }
                    }}
                    className="ml-2 text-black dark:text-white hover:text-gray-500"
                    title={
                      editableContentIndexes.includes(index)
                        ? "Done Editing"
                        : "Edit Content"
                    }
                  >
                    <FontAwesomeIcon
                      icon={faPenToSquare}
                      className="w-4 h-4"
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showMergeButton && (
          <div className="mt-8">
            {/* Persistent Warning Alert */}
            <div className="max-w-3xl mx-auto mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-r-lg shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FaExclamationTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                    Warning
                  </h3>
                  <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    Please copy this to your clipboard. If you perform a new
                    search or navigate away, the document will not be saved.
                  </div>
                </div>
              </div>
            </div>

            {/* Merge Buttons */}
            <div className="text-center flex justify-center space-x-4">
              <button
                onClick={handleMerge}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-300 transform hover:scale-105"
              >
                Merge Titles & Contents into a Single Document
              </button>
              <button
                onClick={handleMergeTitles}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-300 transform hover:scale-105"
              >
                Merge Titles into a Single Document
              </button>
            </div>
          </div>
        )}

        {mergedDocument && (
          <div className="mt-8">
            <label className="block text-lg font-medium mb-4">
              Merged Document of {documentSubtype || documentType}
            </label>
            <div className="relative">
              <div className="prose dark:prose-invert max-w-none w-full p-6 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg max-h-[100vh] overflow-y-auto">
                <ReactMarkdown>{mergedDocument}</ReactMarkdown>
              </div>

              <button
                onClick={() => handleCopy(mergedDocument, 0, "content")}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                title="Copy Merged Document"
              >
                {copiedStatus[0]?.content ? (
                  <FaCheck className="w-5 h-5" />
                ) : (
                  <FaRegCopy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}

        {mergedTitles && (
          <div className="mt-8">
            <label className="block text-lg font-medium mb-4">
              Merged Titles
            </label>
            <div className="relative">
              <textarea
                value={mergedTitles}
                onChange={(e) => setMergedTitles(e.target.value)}
                className="w-full p-6 border border-gray-300 dark:border-transparent bg-white dark:bg-[#3B3B3B] text-black dark:text-white rounded-lg"
                rows={8} // Smaller text area for titles
              ></textarea>
              <button
                onClick={() => handleCopy(mergedTitles, 0, "content")}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                title="Copy Merged Titles"
              >
                {copiedStatus[0]?.content ? (
                  <FaCheck className="w-5 h-5" />
                ) : (
                  <FaRegCopy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Loading and Error Handling */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center mt-8">
            <FadeLoader
              color="#000000"
              height={11.5}
              width={4}
              radius={5}
              margin={-2}
              speedMultiplier={1.2}
            />
            <p className="mt-4 text-lg font-medium text-black dark:text-white">
              {progressMessage}
            </p>
          </div>
        )}
        {error && <p className="text-red-500 mt-6 text-center">{error}</p>}
      </div>
      <style jsx>{`
          @keyframes fadeSlideInOut {
            0% {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            10% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            90% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
          }

          .fade-slide-in-out {
            animation: fadeSlideInOut 3s forwards;
          }

          .stop-button-container {
            opacity: 0;
            transform: scale(0.95);
            transition:
              opacity 0.3s ease,
              transform 0.3s ease;
          }

          .stop-button-container.show {
            opacity: 1;
            transform: scale(1);
          }

          .stop-button-container.hide {
            opacity: 0;
            transform: scale(0.95);
          }
        `}</style>
      {/* </div> */}
    </>
  );
};

export default Page;
