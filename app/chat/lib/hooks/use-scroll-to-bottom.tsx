import { useEffect, useRef, type RefObject } from "react";

export function useScrollToBottom(): [
  RefObject<HTMLDivElement>,
  RefObject<HTMLDivElement>,
] {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (!container || !end) return;

    // Initial scroll to bottom
    setTimeout(() => {
      end.scrollIntoView({ behavior: "instant", block: "end" });
    }, 100);

    // Track if user has manually scrolled up
    const handleScroll = () => {
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // If user is scrolled up, mark as manually scrolling
      isUserScrollingRef.current = distanceFromBottom > 100;
    };

    // Handle mutations
    const observer = new MutationObserver((mutations) => {
      if (!container || !end) return;

      // Check if mutation is related to expand/collapse
      const isToggleSection = mutations.some((mutation) => {
        // Check if the target or parent is a motion-div (expanded content)
        let target = mutation.target as HTMLElement;
        let isExpand = false;

        while (target && target !== container) {
          if (target.classList?.contains("motion-div")) {
            isExpand = true;
            break;
          }
          target = target.parentElement as HTMLElement;
        }
        return isExpand;
      });

      // Don't scroll for expand/collapse actions
      if (isToggleSection) return;

      // Only auto-scroll if user hasn't manually scrolled up
      if (!isUserScrollingRef.current) {
        // For new messages, use smooth scrolling
        end.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    // Add scroll event listener
    container.addEventListener("scroll", handleScroll);

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return [containerRef, endRef] as [
    RefObject<HTMLDivElement>,
    RefObject<HTMLDivElement>,
  ];
}
