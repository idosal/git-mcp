import { useState, useEffect } from "react";
import ChatPageClient from "./.client/chatPage.client";
export default function ChatPageServer({
  owner,
  repo,
}: {
  owner: string | null;
  repo: string | null;
}) {
  const [client, setClient] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setClient(true);
    }
  }, []);
  if (client) {
    return <ChatPageClient owner={owner} repo={repo} />;
  } else {
    return <div></div>;
  }
}
