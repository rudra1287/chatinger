import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Bell,
  Check,
  CheckCheck,
  LogOut,
  MessageCircle,
  MoreVertical,
  Search,
  Send,
  Settings,
  UserPlus,
  UserRound,
  Users,
  X
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { Avatar } from "./components/Avatar";
import {
  api,
  type User
} from "./lib";

type Friend = User & {
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
};

type FriendRequest = {
  id: string;
  sender: User;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  sender: string;
  receiver: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type ChatProps = {
  user: User;
  onLogout: () => void;
};

function formatTime(date: string) {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPreviewTime(date?: string) {
  if (!date) {
    return "";
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const now = new Date();

  if (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  ) {
    return value.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return value.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

export default function Chat({
  user,
  onLogout
}: ChatProps) {
  const [friends, setFriends] = useState<Friend[]>(
    []
  );

  const [selectedFriend, setSelectedFriend] =
    useState<Friend | null>(null);

  const [messages, setMessages] = useState<
    ChatMessage[]
  >([]);

  const [messageText, setMessageText] =
    useState("");

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] =
    useState<User[]>([]);

  const [requests, setRequests] = useState<
    FriendRequest[]
  >([]);

  const [loadingFriends, setLoadingFriends] =
    useState(true);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");

  const [showRequests, setShowRequests] =
    useState(false);

  const [showProfile, setShowProfile] =
    useState(false);

  const [profilePicture, setProfilePicture] =
    useState(user.profilePicture || "");

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");

  const [profileError, setProfileError] =
    useState("");

  const [profileSuccess, setProfileSuccess] =
    useState("");

  const [savingPicture, setSavingPicture] =
    useState(false);

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [mobileSidebar, setMobileSidebar] =
    useState(true);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(
    null
  );

  const selectedId = selectedFriend?.id || "";

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const aTime = a.lastMessageTime
        ? new Date(a.lastMessageTime).getTime()
        : 0;

      const bTime = b.lastMessageTime
        ? new Date(b.lastMessageTime).getTime()
        : 0;

      return bTime - aTime;
    });
  }, [friends]);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  useEffect(() => {
    const token =
      localStorage.getItem("chatnova_token");

    if (!token) {
      return;
    }

    const socket = io({
      auth: {
        token
      }
    });

    socketRef.current = socket;

    socket.on("connect_error", () => {
      setError(
        "Real-time connection unavailable. Reconnecting..."
      );
    });

    socket.on("connect", async () => {
      setError("");
      await loadFriends();
      await loadRequests();

      if (selectedId) {
        try {
          const data = await api<{
            messages: ChatMessage[];
          }>(
            `/api/messages/${selectedId}`
          );

          setMessages(data.messages);
        } catch {
          // Conversation refresh is non-critical.
        }
      }
    });

    socket.on("disconnect", () => {
      setError(
        "Real-time connection lost. Reconnecting..."
      );
    });

    socket.on(
      "friend:request",
      async () => {
        await loadRequests();
      }
    );

    socket.on(
      "friend:accepted",
      async () => {
        await loadFriends();
        await loadRequests();
      }
    );

    socket.on(
      "presence:update",
      ({
        userId,
        isOnline
      }: {
        userId: string;
        isOnline: boolean;
      }) => {
        setFriends((current) =>
          current.map((friend) =>
            friend.id === userId
              ? {
                  ...friend,
                  isOnline
                }
              : friend
          )
        );

        setSelectedFriend((current) =>
          current && current.id === userId
            ? {
                ...current,
                isOnline
              }
            : current
        );
      }
    );

    socket.on(
      "message:new",
      (message: ChatMessage) => {
        const isCurrentConversation =
          selectedId &&
          ((message.sender === user.id &&
            message.receiver === selectedId) ||
            (message.sender === selectedId &&
              message.receiver === user.id));

        if (isCurrentConversation) {
          setMessages((current) => {
            if (
              current.some(
                (item) => item.id === message.id
              )
            ) {
              return current;
            }

            return [...current, message];
          });

          if (message.sender === selectedId) {
            socket.emit("message:read", {
              userId: selectedId
            });
          }
        }

        updateFriendPreview(message);
      }
    );

    socket.on(
      "chat:update",
      ({
        userId
      }: {
        userId: string;
      }) => {
        refreshFriendPreview(userId);
      }
    );

    socket.on(
      "messages:read",
      ({
        userId
      }: {
        userId: string;
      }) => {
        if (selectedId === userId) {
          setMessages((current) =>
            current.map((message) =>
              message.sender === user.id
                ? {
                    ...message,
                    read: true
                  }
                : message
            )
          );
        }
      }
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedId, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  async function loadFriends() {
    setLoadingFriends(true);
    setError("");

    try {
      const data = await api<{
        friends: User[];
      }>("/api/friends");

      const enriched = await Promise.all(
        data.friends.map(async (friend) => {
          try {
            const history = await api<{
              messages: ChatMessage[];
            }>(
              `/api/messages/${friend.id}`
            );

            const latest =
              history.messages[
                history.messages.length - 1
              ];

            const unreadCount =
              history.messages.filter(
                (message) =>
                  message.sender === friend.id &&
                  message.receiver === user.id &&
                  !message.read
              ).length;

            return {
              ...friend,
              lastMessage:
                latest?.message || "",
              lastMessageTime:
                latest?.createdAt,
              unreadCount
            };
          } catch {
            return {
              ...friend
            };
          }
        })
      );

      setFriends(enriched);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load friends."
      );
    } finally {
      setLoadingFriends(false);
    }
  }

  async function refreshFriendPreview(
    friendId: string
  ) {
    try {
      const data = await api<{
        messages: ChatMessage[];
      }>(`/api/messages/${friendId}`);

      const latest =
        data.messages[data.messages.length - 1];

      const unreadCount =
        data.messages.filter(
          (message) =>
            message.sender === friendId &&
            message.receiver === user.id &&
            !message.read
        ).length;

      setFriends((current) =>
        current.map((friend) =>
          friend.id === friendId
            ? {
                ...friend,
                lastMessage:
                  latest?.message || "",
                lastMessageTime:
                  latest?.createdAt,
                unreadCount
              }
            : friend
        )
      );
    } catch {
      // Preview refresh is non-critical.
    }
  }

  function updateFriendPreview(
    message: ChatMessage
  ) {
    const friendId =
      message.sender === user.id
        ? message.receiver
        : message.sender;

    setFriends((current) =>
      current.map((friend) => {
        if (friend.id !== friendId) {
          return friend;
        }

        const viewing =
          selectedId === friendId;

        return {
          ...friend,
          lastMessage: message.message,
          lastMessageTime: message.createdAt,
          unreadCount: viewing
            ? 0
            : message.sender === friendId
              ? (friend.unreadCount || 0) + 1
              : friend.unreadCount || 0
        };
      })
    );
  }

  async function loadRequests() {
    try {
      const data = await api<{
        requests: FriendRequest[];
      }>("/api/friends/requests");

      setRequests(data.requests);
    } catch {
      // Request loading is non-critical.
    }
  }

  async function selectFriend(friend: Friend) {
    setSelectedFriend(friend);
    setMobileSidebar(false);
    setLoadingMessages(true);
    setError("");

    try {
      const data = await api<{
        messages: ChatMessage[];
      }>(`/api/messages/${friend.id}`);

      setMessages(data.messages);

      setFriends((current) =>
        current.map((item) =>
          item.id === friend.id
            ? {
                ...item,
                unreadCount: 0
              }
            : item
        )
      );

      socketRef.current?.emit(
        "message:read",
        {
          userId: friend.id
        }
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load conversation."
      );
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendFriendRequest(
    username: string
  ) {
    try {
      await api("/api/friends/request", {
        method: "POST",
        body: JSON.stringify({
          username
        })
      });

      setSearchResults((current) =>
        current.filter(
          (result) => result.username !== username
        )
      );

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send request."
      );
    }
  }

  async function acceptRequest(
    request: FriendRequest
  ) {
    try {
      await api(
        `/api/friends/requests/${request.id}/accept`,
        {
          method: "POST"
        }
      );

      setRequests((current) =>
        current.filter(
          (item) => item.id !== request.id
        )
      );

      await loadFriends();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to accept request."
      );
    }
  }

  async function rejectRequest(
    requestId: string
  ) {
    try {
      await api(
        `/api/friends/requests/${requestId}`,
        {
          method: "DELETE"
        }
      );

      setRequests((current) =>
        current.filter(
          (item) => item.id !== requestId
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove request."
      );
    }
  }

  async function removeFriend() {
    if (!selectedFriend) {
      return;
    }

    const confirmed = window.confirm(
      `Remove @${selectedFriend.username} from your friends?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        `/api/friends/${selectedFriend.id}`,
        {
          method: "DELETE"
        }
      );

      setFriends((current) =>
        current.filter(
          (friend) =>
            friend.id !== selectedFriend.id
        )
      );

      setSelectedFriend(null);
      setMessages([]);
      setMobileSidebar(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove friend."
      );
    }
  }

  function handleProfilePicture(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setProfileError("");
    setProfileSuccess("");

    if (!file.type.startsWith("image/")) {
      setProfileError(
        "Please select an image file."
      );
      return;
    }

    if (file.size > 1_500_000) {
      setProfileError(
        "Profile picture must be smaller than 1.5 MB."
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setProfilePicture(
        String(reader.result || "")
      );
    };

    reader.readAsDataURL(file);
  }

  async function saveProfilePicture() {
    if (!profilePicture) {
      setProfileError(
        "Please select a profile picture."
      );
      return;
    }

    setSavingPicture(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const data = await api<{
        user: User;
      }>("/api/profile/picture", {
        method: "PUT",
        body: JSON.stringify({
          profilePicture
        })
      });

      setProfileSuccess(
        "Profile picture updated."
      );

      setProfilePicture(
        data.user.profilePicture
      );

      window.dispatchEvent(
        new CustomEvent(
          "chatnova:user-updated",
          {
            detail: data.user
          }
        )
      );
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : "Unable to update profile picture."
      );
    } finally {
      setSavingPicture(false);
    }
  }

  async function changePassword() {
    setProfileError("");
    setProfileSuccess("");

    if (
      !currentPassword ||
      !newPassword ||
      !confirmNewPassword
    ) {
      setProfileError(
        "Fill in all password fields."
      );
      return;
    }

    if (newPassword.length < 6) {
      setProfileError(
        "New password must contain at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setProfileError(
        "New passwords do not match."
      );
      return;
    }

    setChangingPassword(true);

    try {
      await api("/api/profile/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword:
            confirmNewPassword
        })
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setProfileSuccess(
        "Password changed successfully."
      );
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : "Unable to change password."
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function sendMessage() {
    const text = messageText.trim();

    if (
      !text ||
      !selectedFriend ||
      sending
    ) {
      return;
    }

    const socket = socketRef.current;

    if (!socket?.connected) {
      setError(
        "Real-time connection is not available."
      );
      return;
    }

    setSending(true);
    setMessageText("");
    setError("");

    socket.emit(
      "message:send",
      {
        receiver: selectedFriend.id,
        message: text
      },
      (response: {
        ok: boolean;
        error?: string;
      }) => {
        setSending(false);

        if (!response.ok) {
          setMessageText(text);
          setError(
            response.error ||
              "Unable to send message."
          );
        }
      }
    );
  }

  async function searchUsers(value: string) {
    setSearch(value);

    const query = value.trim();

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await api<{
        users: User[];
      }>(
        `/api/friends/search?q=${encodeURIComponent(
          query
        )}`
      );

      setSearchResults(data.users);
    } catch {
      setSearchResults([]);
    }
  }

  function handleMessageKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#070812] text-white md:p-3">
      <div className="glass mx-auto flex h-full max-w-[1500px] overflow-hidden md:rounded-3xl">
        {/* SIDEBAR */}
        <aside
          className={`${
            mobileSidebar
              ? "flex"
              : "hidden md:flex"
          } relative w-full flex-col border-r border-white/[0.07] bg-[#0b0d1b]/80 md:w-[350px] md:min-w-[320px]`}
        >
          <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-950/30">
                <MessageCircle
                  size={21}
                />
              </div>

              <div>
                <h1 className="text-lg font-black">
                  Chat
                  <span className="text-violet-400">
                    Nova
                  </span>
                </h1>

                <p className="text-[11px] text-slate-600">
                  Simple. Private. Connected.
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                setShowRequests(true)
              }
              className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              title="Friend requests"
            >
              <Bell size={19} />

              {requests.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-bold">
                  {requests.length}
                </span>
              )}
            </button>
          </header>

          <div className="border-b border-white/[0.07] p-4">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3.5 top-3.5 text-slate-600"
              />

              <input
                value={search}
                onChange={(event) =>
                  searchUsers(
                    event.target.value
                  )
                }
                placeholder="Search users..."
                className="input-field pl-10"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/[0.07] bg-[#111326]">
                {searchResults.map(
                  (result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 border-b border-white/[0.05] px-3 py-3 last:border-0"
                    >
                      <Avatar
                        user={result}
                        size="sm"
                        online={
                          result.isOnline
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          @{result.username}
                        </div>

                        <div className="text-[11px] text-slate-600">
                          {result.isOnline
                            ? "Online"
                            : "Offline"}
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          sendFriendRequest(
                            result.username
                          )
                        }
                        className="rounded-lg bg-violet-500/10 p-2 text-violet-300 transition hover:bg-violet-500/20"
                        title="Add friend"
                      >
                        <UserPlus
                          size={16}
                        />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Friends
              </span>

              <span className="text-xs text-slate-700">
                {friends.length}
              </span>
            </div>

            {loadingFriends ? (
              <div className="px-5 py-8 text-center text-sm text-slate-600">
                Loading friends...
              </div>
            ) : sortedFriends.length === 0 ? (
              <div className="px-7 py-12 text-center">
                <Users
                  size={30}
                  className="mx-auto mb-3 text-slate-700"
                />

                <p className="text-sm font-medium text-slate-500">
                  No friends yet
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-700">
                  Search for a username above
                  to send a friend request.
                </p>
              </div>
            ) : (
              sortedFriends.map(
                (friend) => (
                  <button
                    key={friend.id}
                    onClick={() =>
                      selectFriend(friend)
                    }
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left transition ${
                      selectedId === friend.id
                        ? "bg-violet-500/10"
                        : "hover:bg-white/[0.035]"
                    }`}
                  >
                    <Avatar
                      user={friend}
                      size="md"
                      online={
                        friend.isOnline
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {friend.username}
                        </span>

                        <span className="shrink-0 text-[10px] text-slate-700">
                          {formatPreviewTime(
                            friend.lastMessageTime
                          )}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-600">
                          {friend.lastMessage ||
                            (friend.isOnline
                              ? "Online"
                              : "Offline")}
                        </span>

                        {!!friend.unreadCount && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 px-1.5 text-[10px] font-bold">
                            {friend.unreadCount >
                            99
                              ? "99+"
                              : friend.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              )
            )}
          </div>

          <footer className="border-t border-white/[0.07] p-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.025] p-3">
              <Avatar
                user={user}
                size="md"
                online
              />

              <button
                onClick={() =>
                  setShowProfile(true)
                }
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-bold">
                  {user.username}
                </div>

                <div className="text-[11px] text-emerald-400">
                  Online
                </div>
              </button>

              <button
                onClick={onLogout}
                className="rounded-xl p-2.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-300"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </footer>
        </aside>

        {/* CHAT */}
        <section
          className={`${
            mobileSidebar
              ? "hidden md:flex"
              : "flex"
          } min-w-0 flex-1 flex-col bg-[#080a15]/70`}
        >
          {!selectedFriend ? (
            <div className="flex flex-1 items-center justify-center px-8">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500/10">
                  <MessageCircle
                    size={34}
                    className="text-violet-400"
                  />
                </div>

                <h2 className="text-xl font-bold">
                  Select a friend
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Select a friend from your list
                  to start chatting.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4 md:px-6">
                <button
                  onClick={() => {
                    setMobileSidebar(true);
                    setSelectedFriend(null);
                  }}
                  className="mr-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 md:hidden"
                >
                  <X size={19} />
                </button>

                <Avatar
                  user={selectedFriend}
                  size="md"
                  online={
                    selectedFriend.isOnline
                  }
                />

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold md:text-base">
                    {selectedFriend.username}
                  </h2>

                  <p
                    className={`text-xs ${
                      selectedFriend.isOnline
                        ? "text-emerald-400"
                        : "text-slate-600"
                    }`}
                  >
                    {selectedFriend.isOnline
                      ? "Online"
                      : "Offline"}
                  </p>
                </div>

                <button
                  onClick={removeFriend}
                  className="rounded-xl p-2.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-300"
                  title="Remove friend"
                >
                  <MoreVertical
                    size={19}
                  />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-600">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
                        <MessageCircle
                          size={21}
                          className="text-slate-700"
                        />
                      </div>

                      <p className="text-sm text-slate-600">
                        No messages yet.
                      </p>

                      <p className="mt-1 text-xs text-slate-700">
                        Say hello to{" "}
                        {selectedFriend.username}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
                    {messages.map(
                      (message) => {
                        const own =
                          message.sender ===
                          user.id;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${
                              own
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2.5 md:max-w-[65%] ${
                                own
                                  ? "rounded-br-md bg-linear-to-br from-violet-600 to-blue-600"
                                  : "rounded-bl-md bg-[#15182a] ring-1 ring-white/[0.05]"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {
                                  message.message
                                }
                              </p>

                              <div
                                className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                                  own
                                    ? "text-violet-200/70"
                                    : "text-slate-600"
                                }`}
                              >
                                {formatTime(
                                  message.createdAt
                                )}

                                {own &&
                                  (message.read ? (
                                    <CheckCheck
                                      size={12}
                                    />
                                  ) : (
                                    <Check
                                      size={12}
                                    />
                                  ))}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                    <div
                      ref={messagesEndRef}
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="mx-4 mb-2 rounded-xl border border-red-500/15 bg-red-500/10 px-4 py-2 text-xs text-red-300 md:mx-auto md:w-full md:max-w-3xl">
                  {error}
                </div>
              )}

              <div className="border-t border-white/[0.07] p-3 md:p-4">
                <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-2">
                  <input
                    value={messageText}
                    onChange={(event) =>
                      setMessageText(
                        event.target.value
                      )
                    }
                    onKeyDown={
                      handleMessageKeyDown
                    }
                    placeholder={`Message ${selectedFriend.username}...`}
                    maxLength={2000}
                    className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-700"
                  />

                  <button
                    onClick={sendMessage}
                    disabled={
                      !messageText.trim() ||
                      sending
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-30"
                    title="Send message"
                  >
                    <Send size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* REQUESTS MODAL */}
      {showRequests && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() =>
            setShowRequests(false)
          }
        >
          <div
            className="glass w-full max-w-md rounded-3xl p-5 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold">
                  Friend requests
                </h3>

                <p className="mt-1 text-xs text-slate-600">
                  {requests.length} pending
                </p>
              </div>

              <button
                onClick={() =>
                  setShowRequests(false)
                }
                className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="py-10 text-center">
                <Bell
                  size={28}
                  className="mx-auto mb-3 text-slate-700"
                />

                <p className="text-sm text-slate-600">
                  No pending requests.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map(
                  (request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.025] p-3"
                    >
                      <Avatar
                        user={
                          request.sender
                        }
                        size="md"
                        online={
                          request.sender
                            .isOnline
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          @
                          {
                            request.sender
                              .username
                          }
                        </div>

                        <div className="text-xs text-slate-600">
                          wants to be your
                          friend
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          acceptRequest(
                            request
                          )
                        }
                        className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300 hover:bg-emerald-500/20"
                        title="Accept"
                      >
                        <Check
                          size={17}
                        />
                      </button>

                      <button
                        onClick={() =>
                          rejectRequest(
                            request.id
                          )
                        }
                        className="rounded-xl bg-red-500/10 p-2.5 text-red-300 hover:bg-red-500/20"
                        title="Reject"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() =>
            setShowProfile(false)
          }
        >
          <div
            className="glass max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 text-center shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-5 flex justify-end">
              <button
                onClick={() =>
                  setShowProfile(false)
                }
                className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <Avatar
              user={{
                ...user,
                profilePicture
              }}
              size="lg"
              online
            />

            <h3 className="mt-4 text-xl font-bold">
              @{user.username}
            </h3>

            <p className="mt-1 text-sm text-emerald-400">
              Online
            </p>

            {profileError && (
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-300">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-left text-sm text-emerald-300">
                {profileSuccess}
              </div>
            )}

            <div className="mt-6 text-left">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Profile picture
              </label>

              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-400 transition hover:border-violet-500/40 hover:text-white">
                Choose new picture

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicture}
                  className="hidden"
                />
              </label>

              <button
                onClick={saveProfilePicture}
                disabled={
                  savingPicture ||
                  !profilePicture ||
                  profilePicture ===
                    user.profilePicture
                }
                className="mt-2 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold transition hover:bg-violet-500 disabled:opacity-40"
              >
                {savingPicture
                  ? "Saving..."
                  : "Save profile picture"}
              </button>
            </div>

            <div className="mt-6 border-t border-white/[0.07] pt-6 text-left">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold">
                <Settings
                  size={16}
                  className="text-violet-400"
                />
                Change password
              </h4>

              <div className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(
                      event.target.value
                    )
                  }
                  placeholder="Current password"
                  className="input-field"
                  autoComplete="current-password"
                />

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value
                    )
                  }
                  placeholder="New password"
                  className="input-field"
                  autoComplete="new-password"
                />

                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) =>
                    setConfirmNewPassword(
                      event.target.value
                    )
                  }
                  placeholder="Confirm new password"
                  className="input-field"
                  autoComplete="new-password"
                />

                <button
                  onClick={changePassword}
                  disabled={changingPassword}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-40"
                >
                  {changingPassword
                    ? "Changing..."
                    : "Change password"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/[0.025] p-3 text-left">
              <UserRound
                size={17}
                className="text-violet-400"
              />

              <div>
                <div className="text-xs text-slate-600">
                  Username
                </div>

                <div className="text-sm">
                  {user.username}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
