"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 96;

/**
 * ChatGPT-style scroll management:
 * - Stick to bottom only when the user is already near the bottom (or on send)
 * - Manual upward scroll disables auto-follow and shows "Jump to latest"
 */
export function useChatScroll(options: {
  itemCount: number;
  streaming: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const updateStickState = useCallback((next: boolean) => {
    stickToBottomRef.current = next;
    setStickToBottom(next);
    setShowJumpToLatest(!next);
  }, []);

  const isNearBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    updateStickState(true);
    scrollToBottom("smooth");
  }, [scrollToBottom, updateStickState]);

  /** Call when the user sends a message — always re-enable stick + scroll. */
  const onUserSend = useCallback(() => {
    updateStickState(true);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [scrollToBottom, updateStickState]);

  const onScroll = useCallback(() => {
    const near = isNearBottom();
    if (near) {
      updateStickState(true);
    } else if (stickToBottomRef.current) {
      updateStickState(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [isNearBottom, updateStickState]);

  // IntersectionObserver as a secondary near-bottom signal
  useEffect(() => {
    const root = viewportRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          updateStickState(true);
        }
      },
      { root, threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [updateStickState, options.itemCount]);

  // Auto-follow only while stuck to bottom (streaming or new content)
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(options.streaming ? "auto" : "smooth");
  }, [options.itemCount, options.streaming, scrollToBottom]);

  // During streaming, keep following if still stuck — driven by content growth
  // via a lightweight ResizeObserver on the scroll content.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const content = el.firstElementChild;
    if (!content) return;

    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [options.itemCount, options.streaming]);

  return {
    viewportRef,
    bottomSentinelRef,
    stickToBottom,
    showJumpToLatest,
    onScroll,
    jumpToLatest,
    onUserSend,
    scrollToBottom,
  };
}
