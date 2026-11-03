// Sign-in screen, account and share rows, and the invite gate.
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, redirectUrl, SHARE_URL } from "./supabase";
import { startSync, stopSync } from "./sync";

const C = {
  base: "#12151A",
  card: "#222B36",
  field: "#2F3A47",
  border: "#3A4655",
  text: "#F3F6FA",
  sub: "#B7C2D0",
  aqua: "#22D3EE",
  onAqua: "#04121A",
  err: "#FCA5A5",
  ok: "#86EFAC",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

// ---- tiny session store shared by the gate and the account rows ----
let current: Session | null | undefined = undefined;
const listeners = new Set<() => void>();
let openAuthFn: (() => void) | null = null;

function setCurrent(s: Session | null) {
  current = s;
  listeners.forEach((l) => l());
}

export function useSession(): Session | null | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return current;
}

export function openSignIn() {
  if (openAuthFn) openAuthFn();
}

function hasInvite(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("invite");
  } catch {
    return false;
  }
}

function stripInvite() {
  try {
    const p = new URLSearchParams(window.location.search);
    p.delete("invite");
    const q = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? "?" + q : ""));
  } catch {
    // ignore
  }
}

// ---- sign-in screen ----
const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 48,
  borderRadius: 14,
  border: "1px solid " + C.border,
  background: C.field,
  color: C.text,
  fontSize: 16,
  padding: "0 14px",
  outline: "none",
  fontFamily: C.font,
};

const primaryBtn: CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 24,
  border: "none",
  cursor: "pointer",
  background: C.aqua,
  color: C.onAqua,
  fontSize: 16,
  fontWeight: 700,
  boxShadow: "0 0 14px rgba(34,211,238,0.35)",
  fontFamily: C.font,
};

const secondaryBtn: CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 23,
  border: "1px solid " + C.border,
  cursor: "pointer",
  background: "transparent",
  color: C.text,
  fontSize: 15,
  fontWeight: 600,
  fontFamily: C.font,
};

// Turns Supabase errors into plain messages.
function friendly(err: { message: string; code?: string }): string {
  const m = err.message || "";
  if (err.code === "signup_disabled" || err.code === "otp_disabled" || /signups? not allowed/i.test(m)) {
    return "New accounts are invite-only right now. Ask the person who shared this link to invite your email, then use the link in that email.";
  }
  if (/confirm/i.test(m)) return "Please confirm your email first. Check your inbox for the link.";
  if (err.code === "invalid_credentials" || m === "Invalid login credentials") return "That email and password don't match. Try again, or use a magic link.";
  if (/rate limit|too many/i.test(m) || err.code === "over_email_send_rate_limit") return "Too many tries. Wait a minute and try again.";
  return m || "Something went wrong. Please try again.";
}

export function AuthScreen(props: { logo: ReactNode; invited?: boolean; onClose?: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setError("");
    setInfo("");
    const e = email.trim();
    if (!e || !password) {
      setError("Enter your email and a password.");
      return;
    }
    if (mode === "up" && password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: e, password });
        if (err) setError(friendly(err));
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: e, password, options: { emailRedirectTo: redirectUrl() } });
        if (err) setError(friendly(err));
        else if (data.user && data.user.identities && data.user.identities.length === 0) setError("That email may already have an account. Try signing in instead.");
        else if (!data.session) setInfo("Check your email to confirm your account. The link brings you back here signed in.");
      }
    } catch {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
    }
    setBusy(false);
  };

  const magic = async () => {
    setError("");
    setInfo("");
    const e = email.trim();
    if (!e) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { emailRedirectTo: redirectUrl() } });
      if (err) setError(friendly(err));
      else setInfo("Check your email for a sign-in link. Open it on this device.");
    } catch {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div
      role={props.onClose ? "dialog" : undefined}
      aria-modal={props.onClose ? true : undefined}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: C.base, color: C.text, fontFamily: C.font, overflowY: "auto", WebkitOverflowScrolling: "touch", colorScheme: "dark" }}
    >
      <div style={{ minHeight: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            {props.logo}
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "30px" }}>Kettlebell Workout</div>
            <div style={{ fontSize: 15, color: C.sub, lineHeight: "21px" }}>
              {props.invited ? "You've been invited — sign in to start." : "Sign in to keep your progress on every device."}
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 24, padding: 18, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 10px 24px rgba(0,0,0,0.5)" }}>
            <div role="tablist" style={{ display: "flex", background: C.field, borderRadius: 14, padding: 4, gap: 4 }}>
              {(["in", "up"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError("");
                    setInfo("");
                  }}
                  style={{ flex: 1, height: 38, borderRadius: 11, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: C.font, background: mode === m ? C.aqua : "transparent", color: mode === m ? C.onAqua : C.text }}
                >
                  {m === "in" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                void submit();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <input type="email" autoComplete="email" inputMode="email" placeholder="Email" aria-label="Email" value={email} onChange={(ev) => setEmail(ev.target.value)} style={fieldStyle} />
              <input
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                style={fieldStyle}
              />
              <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
                {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
              </button>
            </form>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub, fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              or
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <button onClick={() => void magic()} disabled={busy} style={{ ...secondaryBtn, opacity: busy ? 0.6 : 1 }}>
              Email me a magic link
            </button>
            {error ? <div role="alert" style={{ fontSize: 14, lineHeight: "20px", color: C.err }}>{error}</div> : null}
            {info ? <div role="status" style={{ fontSize: 14, lineHeight: "20px", color: C.ok }}>{info}</div> : null}
          </div>
          {props.onClose ? (
            <button onClick={props.onClose} style={{ alignSelf: "center", background: "transparent", border: "none", cursor: "pointer", color: C.sub, fontSize: 14, fontWeight: 600, padding: 8, fontFamily: C.font }}>
              Not now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---- account + share rows for the settings sheet ----
async function shareLink(): Promise<string> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: "Daily Kettlebell Workout", text: "Join me on Daily Kettlebell Workout", url: SHARE_URL });
      return "";
    } catch (e) {
      if (e && (e as Error).name === "AbortError") return "";
    }
  }
  try {
    await navigator.clipboard.writeText(SHARE_URL);
    return "Link copied";
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = SHARE_URL;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) return "Link copied";
    } catch {
      // fall through
    }
  }
  return "Copy this link: " + SHARE_URL;
}

export function AccountRows(props: { rowStyle: CSSProperties; btnStyle: CSSProperties; subColor: string }) {
  const session = useSession();
  const [msg, setMsg] = useState("");
  const email = session && session.user ? session.user.email || "Signed in" : "";
  const aquaBtn: CSSProperties = { ...props.btnStyle, border: "none", cursor: "pointer", background: C.aqua, color: C.onAqua };
  const plainBtn: CSSProperties = { ...props.btnStyle, border: "none", cursor: "pointer", background: C.border, color: C.text };
  return (
    <>
      <div style={props.rowStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Account</div>
          <div style={{ fontSize: 12, color: props.subColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email ? email : "Not signed in"}</div>
        </div>
        {email ? (
          <button onClick={() => void supabase.auth.signOut()} style={plainBtn}>
            Sign out
          </button>
        ) : (
          <button onClick={openSignIn} style={aquaBtn}>
            Sign in
          </button>
        )}
      </div>
      <div style={props.rowStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Share the app</div>
        <button
          onClick={async () => {
            const m = await shareLink();
            setMsg(m);
            if (m === "Link copied") window.setTimeout(() => setMsg(""), 2500);
          }}
          style={aquaBtn}
        >
          Share
        </button>
      </div>
      {msg ? (
        <div role="status" style={{ fontSize: 12, lineHeight: "16px", color: props.subColor, padding: "0 6px", overflowWrap: "anywhere" }}>
          {msg}
        </div>
      ) : null}
    </>
  );
}

// ---- root: invite gate around the app ----
export function Root(props: { app: ReactNode; logo: ReactNode }) {
  const [invited] = useState<boolean>(() => hasInvite());
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    openAuthFn = () => setShowAuth(true);
    let lastUid = "";
    const onSession = (s: Session | null) => {
      setSession(s);
      setCurrent(s);
      const uid = s && s.user ? s.user.id : "";
      if (uid) {
        setShowAuth(false);
        if (hasInvite()) stripInvite();
      }
      if (uid && uid !== lastUid) {
        lastUid = uid;
        // Defer so we never call Supabase inside the auth callback.
        window.setTimeout(() => {
          void startSync(uid).then((changed) => {
            if (!changed) return;
            try {
              const n = Number(sessionStorage.getItem("kb-sync-reloads") || "0");
              if (n >= 2) return;
              sessionStorage.setItem("kb-sync-reloads", String(n + 1));
            } catch {
              return;
            }
            window.location.reload();
          });
        }, 0);
      }
      if (!uid && lastUid) {
        lastUid = "";
        stopSync();
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => onSession(data.session))
      .catch(() => onSession(null));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => onSession(s));
    return () => {
      openAuthFn = null;
      data.subscription.unsubscribe();
    };
  }, []);

  if (invited && session === undefined) {
    return <div style={{ position: "fixed", inset: 0, background: C.base }} aria-busy="true" />;
  }
  if (invited && !session) {
    return <AuthScreen logo={props.logo} invited />;
  }
  return (
    <>
      {props.app}
      {showAuth && !session ? <AuthScreen logo={props.logo} onClose={() => setShowAuth(false)} /> : null}
    </>
  );
}
