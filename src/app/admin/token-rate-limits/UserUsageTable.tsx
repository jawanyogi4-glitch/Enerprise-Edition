"use client";

import useSWR from "swr";
import Text from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { FiActivity, FiCpu, FiClock } from "react-icons/fi";

interface UserUsageStat {
  user_id: string;
  email: string;
  total_tokens: number;
  session_count: number;
  time_created: string | null;
  models_used: string[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function UserUsageTable() {
  const { data, isLoading, error } = useSWR<UserUsageStat[]>(
    "/api/admin/token-rate-limits/user-usage-stats",
    fetcher
  );

  const formatModelName = (name: string | null) => {
    if (!name) return "Default";
    let formatted = name
      .replace("__gemini__", "")
      .replace("__cerebras__llama-3.3-70b", "");
    return formatted.replace("__", " ").trim();
  };

  if (isLoading) {
    return (
      <div className="mt-8 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <Text className="text-red-600 dark:text-red-400">
          Failed to load usage statistics. Please try refreshing the page.
        </Text>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <Separator />

      <div className="mt-8 mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <FiActivity className="h-6 w-6" />
          User Usage Statistics
        </h2>
        <Text className="text-gray-500 mt-1">
          Real-time overview of token consumption and activity per user.
        </Text>
      </div>

      <div className="overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                User / ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sessions
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Models Used
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((user) => (
              <tr
                key={user.user_id}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.email}
                    </span>
                    <span className="text-xs text-gray-400 font-mono mt-0.5 select-all">
                      {user.user_id}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {user.total_tokens.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                    {user.session_count}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <FiClock className="h-3 w-3 opacity-70" />
                    {user.time_created
                      ? new Date(user.time_created).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "Never"}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {user.models_used && user.models_used.length > 0 ? (
                      user.models_used.map((modelName, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
                        >
                          <FiCpu className="h-3 w-3" />
                          {formatModelName(modelName)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        Default
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No user usage data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
