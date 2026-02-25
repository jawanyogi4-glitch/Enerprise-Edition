"use client";

import { useState } from "react";
import { CalendarIcon, DropdownIcon } from "@/components/icons/icons";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import Button from "@/refresh-components/buttons/Button";
import StepsHITL from "@/app/chat/components/StepsHITL";
import { useRouter } from "next/navigation";
export default function GenerateAgreementPage() {
  const [formData, setFormData] = useState({
    title: "",
    effectiveDate: "",
    country: "",
    state: "",
    description: "",
  });

  const router = useRouter();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleNavigation = () => {
    console.log("scjhbkjsc");
    router.push("/chat/ai-drafting/select-template");
  }

  return (
    <div className="pt-20 px-8 pb-8 w-full">
      <StepsHITL step={1} />
      <h1 className="text-2xl font-bold mb-6">
        AI Drafting - Generate any Agreement
      </h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Document Title */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">
            Document Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Please enter the title of the legal document you would like to draft."
            className="w-full p-3 border rounded-lg"
          />
        </div>

        {/* Effective Date */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">
            Effective Date *
          </label>
          <div className="relative">
            <input
              type="date"
              name="effectiveDate"
              value={formData.effectiveDate}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg"
            />
            {/* Custom Calendar Icon */}
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <CalendarIcon size={20} />
            </div>
          </div>
        </div>

        {/* Country */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">
            Country *
          </label>
          <div className="relative">
            <select
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg"
            >
              <option value="">Select Country</option>
              <option value="India">India</option>
              <option value="USA">USA</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <DropdownIcon size={20} />
            </div>
          </div>
        </div>

        {/* State */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">
            State *
          </label>
          <div className="relative">
            <select
              name="state"
              value={formData.state}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg"
            >
              <option value="">Select State</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="California">California</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <DropdownIcon size={20} />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-2">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={6}
            placeholder="Please enter all relevant information about the document."
            className="w-full p-4 border rounded-lg"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-center">

        <Button
          className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:opacity-90"
          onClick={handleNavigation}>
          Find Template
        </Button>

      </div>

    </div>
  );
}