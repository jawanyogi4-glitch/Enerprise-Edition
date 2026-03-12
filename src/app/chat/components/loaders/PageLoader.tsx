"use client";

import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
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
      }}
    >
      <CircularProgress color="inherit" size={50} />

      <Box>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {text}
        </Typography>
      </Box>
    </Backdrop>
  );
}