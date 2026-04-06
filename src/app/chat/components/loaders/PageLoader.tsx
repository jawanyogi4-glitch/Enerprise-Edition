"use client";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface PageLoaderProps {
  open?: boolean;
  text?: string;
}

export default function PageLoader({
  open = true,
  text = "Processing...",
}: PageLoaderProps) {
  return (
    <Backdrop
      open={open}
      sx={{
        color: "#fff",
        zIndex: (theme) => theme.zIndex.modal + 1,
        flexDirection: "column",
        gap: 2,
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
      }}
    >
      <img
        src="/loaders/ai-loader.gif"
        alt="Loading..."
        style={{ width: 120, height: 120, objectFit: "contain" }}
      />

      <Box>
        <Typography
          variant="body2"
          sx={{
            opacity: 0.9,
            fontSize: "0.95rem",
            fontWeight: 500,
            letterSpacing: "0.02em",
            color: "#fff",
          }}
        >
          {text}
        </Typography>
      </Box>
    </Backdrop>
  );
}