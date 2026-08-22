import type { User } from "../lib";

type AvatarProps = {
  user: Partial<User>;
  size?: "sm" | "md" | "lg";
  online?: boolean;
};

export function Avatar({
  user,
  size = "md",
  online = false
}: AvatarProps) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-xl"
  };

  return (
    <div className="relative shrink-0">
      <div
        className={`${sizes[size]} flex items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-violet-500 to-cyan-400 font-bold text-white`}
      >
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.username || "User"}
            className="h-full w-full object-cover"
          />
        ) : (
          user.username?.slice(0, 1).toUpperCase() || "?"
        )}
      </div>

      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111326] bg-emerald-400" />
      )}
    </div>
  );
}
