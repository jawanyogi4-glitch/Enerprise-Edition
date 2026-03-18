"use client";

import { useState, useEffect } from "react";
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

  const [formData, setFormData] = useState({
    title: "",
    effectiveDate: "",
    country: "India",
    state: "",
    description: "",
  });

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
    <div className="pt-16 px-10 pb-10 w-full min-h-screen bg-[#fafafa] dark:bg-background text-text">

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

        {/* COUNTRY */}
        <div className="col-span-1">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
            Country*
          </label>

          <div className="relative">
            <select
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md text-sm text-gray-800 dark:text-text appearance-none focus:outline-none focus:border-gray-400 dark:focus:border-border-03"
            >
              <option value="" disabled className="text-gray-300">Select Country</option>
              {countries.map((c: any) => (
                <option
                  key={c.cca2}
                  value={c.name.common}
                  disabled={c.name.common !== "India"}
                >
                  {c.name.common}
                </option>
              ))}
            </select>

            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              <DropdownIcon size={18} />
            </div>
          </div>
        </div>

        {/* STATE */}
        <div className="col-span-1">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
            State*
          </label>

          <div className="relative">
            <select
              name="state"
              value={formData.state}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-white dark:bg-background-neutral-02 border border-gray-300 dark:border-border rounded-md text-sm text-gray-800 dark:text-text appearance-none focus:outline-none focus:border-gray-400 dark:focus:border-border-03"
            >
              <option value="">Select State</option>
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              <DropdownIcon size={18} />
            </div>
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