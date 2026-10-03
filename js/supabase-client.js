/* =====================================================================
   Smart Healthcare Assistant | js/supabase-client.js
   Checks js/config.js, then creates ONE shared Supabase connection:
       SHA.db            -> the Supabase client (null if config is wrong)
       SHA.configOk      -> true / false
       SHA.configError   -> friendly message when configOk is false
       SHA.testConnection() -> async check you can run from a page
   Load order in every page:
       supabase-js CDN -> config.js -> supabase-client.js -> common.js
   ===================================================================== */
(function () {
  "use strict";

  var SHA = (window.SHA = window.SHA || {});
  var cfg = window.SHA_CONFIG || {};
  var url = String(cfg.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  var key = String(cfg.SUPABASE_KEY || "").trim();

  // Read the "role" inside a legacy JWT-style key (anon vs service_role).
  function jwtRole(token) {
    try {
      var payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(payload)).role || null;
    } catch (e) {
      return null;
    }
  }

  // Returns a friendly error string, or null when everything looks right.
  function validateConfig() {
    if (!url || !key || url.indexOf("YOUR_") !== -1 || key.indexOf("YOUR_") !== -1) {
      return "Supabase is not set up yet. Open js/config.js and paste your Project URL and publishable key.";
    }
    if (/\/rest\/v1/i.test(url)) {
      return "Your Project URL must not contain /rest/v1. Use only https://your-project-id.supabase.co";
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      return "The Project URL in js/config.js looks wrong. It should look like https://abcdxyz.supabase.co";
    }
    if (key.indexOf("sb_secret_") === 0 || (key.indexOf("eyJ") === 0 && jwtRole(key) === "service_role")) {
      return "DANGER: js/config.js contains a SECRET key. Remove it now and use the publishable (or anon) key instead.";
    }
    if (key.indexOf("sb_publishable_") !== 0 && key.indexOf("eyJ") !== 0) {
      return "The key in js/config.js is not recognised. Copy the publishable key (starts with sb_publishable_) from Project Settings -> API Keys.";
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return "The Supabase library could not load. Check your internet connection and the <script> tag order.";
    }
    return null;
  }

  SHA.configError = validateConfig();
  SHA.configOk = SHA.configError === null;
  SHA.db = null;

  if (SHA.configOk) {
    try {
      SHA.db = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,      // stay logged in after refresh
          autoRefreshToken: true,
          detectSessionInUrl: true   // needed for password-reset links
        }
      });
    } catch (e) {
      SHA.configOk = false;
      SHA.configError = "Could not start Supabase: " + (e && e.message ? e.message : "unknown error");
    }
  }

  // ------------------------------------------------------------------
  // Connection test: 1) can we reach Supabase with this key?
  //                  2) if logged in, can we read our own profile (RLS)?
  // ------------------------------------------------------------------
  SHA.testConnection = async function () {
    if (!SHA.configOk) return { ok: false, message: SHA.configError };

    try {
      var res = await fetch(url + "/auth/v1/settings", { headers: { apikey: key } });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "Supabase rejected the key. Re-copy the publishable key into js/config.js." };
      }
      if (!res.ok) {
        return { ok: false, message: "Supabase answered with an error (HTTP " + res.status + "). Check the Project URL." };
      }

      var sessionResult = await SHA.db.auth.getSession();
      var session = sessionResult.data && sessionResult.data.session;
      if (!session) {
        return { ok: true, message: "Connected to Supabase. You are not logged in (that is normal for now)." };
      }

      var prof = await SHA.db.from("profiles").select("full_name, role").eq("id", session.user.id).maybeSingle();
      if (prof.error) {
        return { ok: false, message: "Connected, but reading your profile failed: " + prof.error.message };
      }
      var role = prof.data ? prof.data.role : "unknown";
      return { ok: true, message: "Connected and logged in. Your role is: " + role + "." };
    } catch (e) {
      return { ok: false, message: "Could not reach Supabase. Check your internet connection and the Project URL." };
    }
  };
})();
