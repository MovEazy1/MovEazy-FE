/**
 * One share panel for everything a broker sends out — a curated list, their
 * QR storefront, a property: WhatsApp (to a contact, or pick a chat), Facebook
 * groups, Telegram, a ready-made post to paste, the link, and the phone's own
 * share sheet.
 *
 * Facebook has no way for a site to post straight into a group; its share
 * dialog has "Share to a group", so the post text is copied first and the
 * broker pastes it there. /b/ and /c/ links carry proper preview cards
 * (api/share.js), so the post shows the photo and the headline.
 */
import { Link2, MoreHorizontal, Send, Users2 } from "lucide-react";
import { WhatsAppIcon, toast } from "./partnerUi";
import { waLink } from "../../lib/partners";

const FbIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
  </svg>
);

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
    return true;
  } catch {
    toast("Couldn't copy — long-press to copy instead.", "error");
    return false;
  }
}

/**
 * url      the link being shared
 * message  the WhatsApp / Telegram text (should include the url)
 * post     text for a Facebook / broker group post (the url is appended)
 * phone    WhatsApp this contact directly (a tenant); otherwise WhatsApp's chat picker
 */
export default function ShareOptions({ url, message, post, phone = "", title = "MovEazy", waLabel, onShare }) {
  const fbPost = `${post || message}\n\n${url}`;
  const items = [
    {
      key: "wa", label: waLabel || (phone ? "WhatsApp client" : "WhatsApp"), tone: "gold", icon: <WhatsAppIcon size={20} />,
      href: phone ? waLink(phone, message) : `https://wa.me/?text=${encodeURIComponent(message)}`,
      onClick: onShare,
    },
    {
      key: "fb", label: "Facebook groups", tone: "fb", icon: <FbIcon />,
      onClick: async () => {
        await copy(fbPost, "Post copied — in Facebook tap “Share to a group” and paste");
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener");
      },
    },
    { key: "tg", label: "Telegram", tone: "tg", icon: <Send size={19} />, href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post || message)}` },
    { key: "post", label: "Copy post", tone: "plain", icon: <Users2 size={19} />, onClick: () => copy(fbPost, "Post copied — paste it in any group") },
    { key: "link", label: "Copy link", tone: "plain", icon: <Link2 size={19} />, onClick: () => copy(url, "Link copied") },
  ];
  if (typeof navigator !== "undefined" && navigator.share) {
    items.push({ key: "more", label: "More apps", tone: "plain", icon: <MoreHorizontal size={20} />,
      onClick: () => navigator.share({ title, text: post || message, url }).catch(() => {}) });
  }

  return (
    <div className="so">
      <style>{CSS}</style>
      {items.map((it) => {
        const body = <><span className={`so-ic so-${it.tone}`}>{it.icon}</span><span className="so-l">{it.label}</span></>;
        return it.href
          ? <a key={it.key} className="so-it" href={it.href} target="_blank" rel="noreferrer" onClick={it.onClick}>{body}</a>
          : <button key={it.key} type="button" className="so-it" onClick={it.onClick}>{body}</button>;
      })}
    </div>
  );
}


const CSS = `
.so { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 10px 6px; }
.so-it { display: grid; justify-items: center; gap: 6px; border: 0; background: none; padding: 4px 2px; cursor: pointer; font: inherit; color: var(--ink); text-decoration: none; }
.so-ic { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; }
.so-gold { background: var(--goldg); color: #1F1605; box-shadow: 0 8px 18px rgba(212,164,55,.35); }
.so-fb { background: #1877F2; color: #fff; }
.so-tg { background: #229ED9; color: #fff; }
.so-plain { background: var(--noir); color: #fff; }
.so-l { font-size: 12px; font-weight: 700; text-align: center; line-height: 1.25; }
`;
