import "server-only";

const DEFAULT_DURATION = 5000;

/** The notice set in SITE_NOTICE, or null when there's none. */
export const getSiteNotice = () => {
  const message = process.env.SITE_NOTICE?.trim();
  if (!message) return null;
  const duration = Number(process.env.SITE_NOTICE_DURATION);
  return {
    message,
    duration: duration > 0 ? duration : DEFAULT_DURATION,
    always: process.env.SITE_NOTICE_ALWAYS === "true",
  };
};
