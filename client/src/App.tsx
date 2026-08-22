import { useEffect, useState } from "react";
import Auth from "./Auth";
import Chat from "./Chat";
import { api, type User } from "./lib";

export default function App() {
  const [user, setUser] = useState<User | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const token =
      localStorage.getItem("chatnova_token");

    if (!token) {
      setLoading(false);
      return;
    }

    api<{ user: User }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem(
          "chatnova_token"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function handleUserUpdate(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<User>;

      if (customEvent.detail) {
        setUser(customEvent.detail);
      }
    }

    window.addEventListener(
      "chatnova:user-updated",
      handleUserUpdate
    );

    return () => {
      window.removeEventListener(
        "chatnova:user-updated",
        handleUserUpdate
      );
    };
  }, []);

  function logout() {
    api("/api/auth/logout", {
      method: "POST"
    }).catch(() => {
      // Local logout still completes if API is unavailable.
    });

    localStorage.removeItem("chatnova_token");
    setUser(null);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#070812] text-sm text-slate-600">
        Loading ChatNova...
      </main>
    );
  }

  if (!user) {
    return (
      <Auth
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser);
        }}
      />
    );
  }

  return (
    <Chat
      user={user}
      onLogout={logout}
    />
  );
}
