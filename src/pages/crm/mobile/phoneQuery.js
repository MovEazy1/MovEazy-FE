/** When the CRM switches to its phone layout. Its own file: App.jsx reads it, and must not pull in the phone UI. */
export const PHONE_QUERY = "(max-width: 767px)";

export const isPhoneNow = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.(PHONE_QUERY)?.matches);
