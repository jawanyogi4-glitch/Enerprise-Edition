// src/api/contractApi.ts

// import axios from "axios";

// const BASE_URL = "http://192.168.166.139:31042/clm";

// // You can later move this to .env
// // process.env.NEXT_PUBLIC_API_BASE_URL

// export const reviewContractAPI = async (request_id: string) => {
//   const response = await axios.post(
//     `${BASE_URL}/AI-Contract/Review`,
//     { request_id },
//     {
//       headers: {
//         "Content-Type": "application/json",
//         accept: "application/json",
//       },
//     }
//   );

//   return response.data;
// };

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendUrl =
      process.env.NEXT_PUBLIC_qilegal_BACKEND_URL ||
      "http://192.168.166.139:31042";

    const response = await fetch(
      `${backendUrl}/clm/AI-Contract/Review`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}