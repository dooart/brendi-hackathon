import { ReactNode } from "react";

export default function Message({ name, theirs, children }: { name: string; theirs: boolean; children: ReactNode }) {
  return (
    <div className={`flex w-full ${theirs ? "justify-start pr-40" : "justify-end pl-40"}`}>
      <div
        className={`px-4 p-3 border-2 border-primary w-full overflow-x-scroll rounded-2xl ${
          theirs ? "bg-white" : "bg-accent"
        }`}
      >
        <div className="flex gap-2 items-center font-heading tracking-tighter text-xl mb-2">{name}</div>
        <div className="min-w-24">{children}</div>
      </div>
    </div>
  );
}
