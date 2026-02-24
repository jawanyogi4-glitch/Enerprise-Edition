"use client";

import { useState } from "react";

export default function GenerateAgreementPage() {
  const [formData, setFormData] = useState({
    title: "",
    effectiveDate: "",
    country: "",
    state: "",
    description: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="p-8 w-full">
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
          <input
            type="date"
            name="effectiveDate"
            value={formData.effectiveDate}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
          />
        </div>

        {/* Country */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">
            Country *
          </label>
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
        </div>

        {/* State */}
        <div className="col-span-1">
          <label className="block text-sm font-medium mb-2">
            State *
          </label>
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

      <div className="mt-8">
        <button className="px-6 py-3 bg-black text-white rounded-lg hover:opacity-90">
          Find Template
        </button>
      </div>
    </div>
  );
}