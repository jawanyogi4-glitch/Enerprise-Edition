"use client";

import { useState, useEffect, useRef } from "react";
import { CalendarIcon, DropdownIcon } from "@/components/icons/icons";
import Button from "@/refresh-components/buttons/Button";
import StepsHITL from "@/app/chat/components/StepsHITL";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setTemplateData } from "@/redux/template";
import PageLoader from "@/app/chat/components/loaders/PageLoader";

export default function GenerateAgreementPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    effectiveDate: "",
    country: "India",
    state: "",
    description: "",
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node))
        setCountryOpen(false);
      if (stateRef.current && !stateRef.current.contains(e.target as Node))
        setStateOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await axios.get(
          "https://restcountries.com/v3.1/all?fields=name,cca2"
        );
        const sorted = res.data.sort((a: any, b: any) =>
          a.name.common.localeCompare(b.name.common)
        );
        setCountries(sorted);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (formData.country === "India") {
      setStates([
        "Maharashtra",
        "Delhi",
        "Karnataka",
        "Tamil Nadu",
        "Gujarat",
        "Uttar Pradesh",
      ]);
    } else {
      setStates([]);
    }
  }, [formData.country]);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNavigation = async () => {
    try {
      setLoading(true);

      const res = await axios.post("/api/find-template", {
        document_title: formData.title,
      });

      dispatch(setTemplateData({ formData, templates: res.data }));
      router.push("/chat/ai-drafting/select-template");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" px-10 py-8 w-full min-h-screen bg-[#fafafa] dark:bg-background text-text">

      <StepsHITL step={1} title="AI Drafting - Generate any Agreement" />

      {loading && <PageLoader text="Finding Template..." />}

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 mt-8">

        {/* INPUT BLOCK */}
        {[
          { label: "Document Title*", name: "title", placeholder: "Please enter the title of the legal document you would like to draft.", type: "text", col: 1 },
          { label: "Effective Date*", name: "effectiveDate", placeholder: "Select date", type: "date", col: 1 },
        ].map((field, i) => (
          <div key={i} className={`col-span-${field.col}`}>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
              {field.label}
            </label>

            <div className="relative">
              <input
                type={field.type}
                name={field.name}
                placeholder={field.placeholder}
                value={(formData as any)[field.name]}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md text-sm text-gray-800 dark:text-text focus:outline-none focus:border-gray-400 dark:focus:border-border-03 placeholder:text-gray-400 dark:placeholder:text-text-03"
              />

              {field.type === "date" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <CalendarIcon size={18} />
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="col-span-1">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
            Country*
          </label>

          <div className="relative" ref={countryRef}>
            {/* Trigger */}
            <button
              type="button"
              onClick={() => { setCountryOpen((o) => !o); setCountrySearch(""); }}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md text-sm text-gray-800 dark:text-text focus:outline-none focus:border-gray-400 dark:focus:border-border-03"
            >
              <span className={formData.country ? "" : "text-gray-400 dark:text-text-03"}>
                {formData.country || "Select Country"}
              </span>
              <DropdownIcon size={18} />
            </button>

            {countryOpen && (
              <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md shadow-lg overflow-hidden">

                <div className="p-2 border-b border-gray-200 dark:border-border">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search country..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded focus:outline-none text-gray-800 dark:text-text placeholder:text-gray-400"
                  />
                </div>
                {/* List */}
                <ul className="max-h-52 overflow-y-auto">
                  {countries
                    .filter((c: any) =>
                      c.name.common.toLowerCase().includes(countrySearch.toLowerCase())
                    )
                    .map((c: any) => {
                      const isSelectable = c.name.common === "India";
                      return (
                        <li
                          key={c.cca2}
                          onClick={() => {
                            if (!isSelectable) return;
                            setFormData((f) => ({ ...f, country: c.name.common }));
                            setCountryOpen(false);
                          }}
                          className={`px-3 py-2 text-sm ${isSelectable
                              ? "cursor-pointer text-gray-800 dark:text-text hover:bg-gray-100 dark:hover:bg-background"
                              : "cursor-not-allowed text-gray-400 dark:text-text-03"
                            } ${formData.country === c.name.common ? "bg-gray-100 dark:bg-background font-medium" : ""}`}
                        >
                          {c.name.common}
                          {!isSelectable && (
                            <span className="ml-2 text-xs text-gray-400">(unavailable)</span>
                          )}
                        </li>
                      );
                    })}
                  {countries.filter((c: any) =>
                    c.name.common.toLowerCase().includes(countrySearch.toLowerCase())
                  ).length === 0 && (
                      <li className="px-3 py-2 text-sm text-gray-400">No results</li>
                    )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* STATE  custom dropdown */}
        <div className="col-span-1">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
            State*
          </label>

          <div className="relative" ref={stateRef}>
            <button
              type="button"
              onClick={() => states.length > 0 && setStateOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md text-sm text-gray-800 dark:text-text focus:outline-none focus:border-gray-400 dark:focus:border-border-03 disabled:opacity-50"
              disabled={states.length === 0}
            >
              <span className={formData.state ? "" : "text-gray-400 dark:text-text-03"}>
                {formData.state || "Select State"}
              </span>
              <DropdownIcon size={18} />
            </button>

            {stateOpen && states.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md shadow-lg overflow-hidden">
                <ul className="max-h-52 overflow-y-auto">
                  {states.map((s) => (
                    <li
                      key={s}
                      onClick={() => {
                        setFormData((f) => ({ ...f, state: s }));
                        setStateOpen(false);
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer text-gray-800 dark:text-text hover:bg-gray-100 dark:hover:bg-background ${formData.state === s ? "bg-gray-100 dark:bg-background font-medium" : ""
                        }`}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
            Description*
          </label>

          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={7}
            placeholder="Please enter all the relevant information about the document you would like to automated system to consider while drafting."
            className="w-full px-3 py-3 bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md text-sm text-gray-800 dark:text-text resize-none focus:outline-none focus:border-gray-400 dark:focus:border-border-03 placeholder:text-gray-400 dark:placeholder:text-text-03"
          />
        </div>
      </div>

      {/* BUTTON */}
      <div className="mt-8 flex justify-center">
        <button
          className="px-6 py-2.5 dark:bg-white dark:text-black bg-black text-white text-sm rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleNavigation}
          disabled={loading}
        >
          {loading ? "Searching..." : "Find Template"}
        </button>
      </div>
    </div>
  );
}