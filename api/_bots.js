/**
 * Is this request a link-preview robot (WhatsApp, Facebook, X, LinkedIn,
 * Telegram, Slack, Google…) rather than a person?
 *
 * The share endpoints look a listing up only to write the preview card, and
 * only robots read that card. A person tapping a link skips the lookup and
 * goes straight on — the lookup was most of the ~2 s a shared link took, and
 * almost every share carries its own tracking code, so it was rarely cached.
 *
 * A request with no user agent at all is treated as a robot: serving it the
 * preview page is always correct, merely slower.
 */
const ROBOT =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|slack|discord|linkedin|embedly|skypeuripreview|pinterest|vkshare|w3c_validator|redditbot|applebot|bingpreview|google-inspectiontool|googleother|quora link preview|outbrain|nuzzel|bitlybot|tumblr|iframely|preview|headless|lighthouse|curl|wget|python|node-fetch|axios|go-http/i;

export function isPreviewRobot(userAgent) {
  const ua = String(userAgent || "").trim();
  if (!ua) return true;
  return ROBOT.test(ua);
}
