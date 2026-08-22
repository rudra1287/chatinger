import { useState } from "react";
import { MessageCircle, Upload } from "lucide-react";
import { api, type User } from "./lib";

type AuthProps = {
  onAuthenticated: (
    user: User,
    token: string
  ) => void;
};

export default function Auth({
  onAuthenticated
}: AuthProps) {
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [profilePicture, setProfilePicture] =
    useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function resetError() {
    if (error) {
      setError("");
    }
  }

  function switchMode() {
    setSignup((value) => !value);
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  function handlePicture(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 1_500_000) {
      setError(
        "Profile picture must be smaller than 1.5 MB."
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setProfilePicture(String(reader.result || ""));
    };

    reader.readAsDataURL(file);
  }

  async function submit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("Username is required.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (signup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const data = await api<{
        token: string;
        user: User;
      }>(
        signup
          ? "/api/auth/signup"
          : "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            signup
              ? {
                  username: cleanUsername,
                  password,
                  confirmPassword,
                  profilePicture
                }
              : {
                  username: cleanUsername,
                  password
                }
          )
        }
      );

      localStorage.setItem(
        "chatnova_token",
        data.token
      );

      onAuthenticated(data.user, data.token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to authenticate."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070812] px-5 py-10">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-700/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />

      <section className="glass relative w-full max-w-md rounded-3xl p-7 shadow-2xl shadow-violet-950/30 sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-900/30">
            <MessageCircle
              size={30}
              strokeWidth={2.2}
            />
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Chat<span className="text-violet-400">Nova</span>
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {signup
              ? "Create your account and start chatting."
              : "Welcome back. Your conversations are waiting."}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Username
            </label>

            <input
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                resetError();
              }}
              placeholder="Enter username"
              autoComplete="username"
              className="input-field"
              maxLength={24}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                resetError();
              }}
              placeholder="Enter password"
              autoComplete={
                signup
                  ? "new-password"
                  : "current-password"
              }
              className="input-field"
              minLength={6}
              required
            />
          </div>

          {signup && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Confirm password
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(
                      event.target.value
                    );
                    resetError();
                  }}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="input-field"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Profile picture
                  <span className="ml-1 text-slate-600">
                    (optional)
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-400 transition hover:border-violet-500/40 hover:bg-white/[0.04]">
                  <Upload size={17} />

                  <span className="truncate">
                    {profilePicture
                      ? "Picture selected"
                      : "Choose a picture"}
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePicture}
                    className="hidden"
                  />
                </label>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-linear-to-r from-violet-600 to-blue-600 px-4 py-3 font-bold shadow-lg shadow-violet-950/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : signup
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-5 w-full text-sm text-slate-500 transition hover:text-white"
        >
          {signup
            ? "Already have an account? Log in"
            : "New to ChatNova? Create an account"}
        </button>
      </section>
    </main>
  );
}
