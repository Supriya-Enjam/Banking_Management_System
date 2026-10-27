import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  ArrowDown,
  Check,
  Circle,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  api,
  type ChatConversation,
  type ChatEmployee,
  type ChatMessageItem,
} from "../services/api";
import "./InternalMessagesView.css";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏", "🎉", "😮"];

interface InternalMessagesViewProps {
  token: string;
  employeeId: string;
  initialConversationId?: string | null;
  onToast: (message: string) => void;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function displayTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InternalMessagesView({
  token,
  employeeId,
  initialConversationId,
  onToast,
}: InternalMessagesViewProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [employees, setEmployees] = useState<ChatEmployee[]>([]);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [typingName, setTypingName] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId
  );
  activeConversationIdRef.current = activeConversationId;

  const visibleConversations = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      conversation.name.toLocaleLowerCase().includes(normalized)
    );
  }, [conversations, search]);

  const visibleEmployees = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    if (!normalized) return employees;
    return employees.filter(
      (employee) =>
        employee.name.toLocaleLowerCase().includes(normalized) ||
        employee.employeeId.toLocaleLowerCase().includes(normalized) ||
        employee.role.toLocaleLowerCase().includes(normalized)
    );
  }, [employees, search]);

  const loadConversations = useCallback(async () => {
    const result = await api.getChatConversations(token);
    setConversations(result.conversations);
  }, [token]);

  const loadEmployees = useCallback(
    async (query: string) => {
      const result = await api.getChatEmployees(token, query);
      setEmployees(result.employees);
    },
    [token]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([loadConversations(), loadEmployees("")])
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load internal messages."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadConversations, loadEmployees]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEmployees(search).catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not search employees."
        );
      });
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [loadEmployees, search]);

  useEffect(() => {
    const socket = io(api.getChatSocketUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnectionState("connected");
      if (activeConversationIdRef.current) {
        const conversationId = activeConversationIdRef.current;
        socket.emit("chat:join", {
          conversationId,
        });
        void api
          .getChatMessages(token, conversationId)
          .then((result) => {
            setMessages((previous) => {
              const byId = new Map(
                [...previous, ...result.messages].map((message) => [
                  message.id,
                  message,
                ])
              );
              return [...byId.values()].sort(
                (left, right) =>
                  new Date(left.createdAt).getTime() -
                  new Date(right.createdAt).getTime()
              );
            });
          })
          .catch((syncError: unknown) => {
            setError(
              syncError instanceof Error
                ? syncError.message
                : "Could not resynchronize messages."
            );
          });
      }
      void loadConversations();
    });
    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));
    socket.on("chat:message", (message: ChatMessageItem) => {
      if (activeConversationIdRef.current === message.conversationId) {
        setMessages((previous) =>
          previous.some((item) => item.id === message.id)
            ? previous
            : [...previous, message]
        );
      }
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id !== message.conversationId
            ? conversation
            : {
                ...conversation,
                lastMessagePreview: message.content.slice(0, 160),
                lastMessageAt: message.createdAt,
                lastMessageSenderId: message.sender.id,
                unreadCount:
                  activeConversationIdRef.current === message.conversationId ||
                  message.sender.id === employeeId
                    ? 0
                    : conversation.unreadCount + 1,
              }
        )
      );
    });
    socket.on(
      "chat:reaction",
      (update: {
        messageId: string;
        reactions: ChatMessageItem["reactions"];
      }) => {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === update.messageId
              ? { ...message, reactions: update.reactions }
              : message
          )
        );
      }
    );
    socket.on(
      "chat:typing",
      (event: { conversationId: string; employeeId: string; name: string; isTyping: boolean }) => {
        if (
          event.conversationId !== activeConversationIdRef.current ||
          event.employeeId === employeeId
        ) {
          return;
        }
        setTypingName(event.isTyping ? event.name : "");
        if (typingTimeoutRef.current) {
          window.clearTimeout(typingTimeoutRef.current);
        }
        if (event.isTyping) {
          typingTimeoutRef.current = window.setTimeout(
            () => setTypingName(""),
            2500
          );
        }
      }
    );
    socket.on("chat:presence", (event: { employeeId: string; online: boolean }) => {
      setEmployees((previous) =>
        previous.map((employee) =>
          employee.id === event.employeeId
            ? { ...employee, online: event.online }
            : employee
        )
      );
      setConversations((previous) =>
        previous.map((conversation) => ({
          ...conversation,
          participants: conversation.participants.map((participant) =>
            participant.id === event.employeeId
              ? { ...participant, online: event.online }
              : participant
          ),
        }))
      );
    });
    socket.on(
      "chat:presence:snapshot",
      (event: { onlineEmployeeIds: string[] }) => {
        const onlineEmployees = new Set(event.onlineEmployeeIds);
        setEmployees((previous) =>
          previous.map((employee) => ({
            ...employee,
            online: onlineEmployees.has(employee.id),
          }))
        );
        setConversations((previous) =>
          previous.map((conversation) => ({
            ...conversation,
            participants: conversation.participants.map((participant) => ({
              ...participant,
              online: onlineEmployees.has(participant.id),
            })),
          }))
        );
      }
    );
    socket.on("chat:membership-added", () => {
      void loadConversations();
    });
    socket.on("chat:membership-changed", () => {
      void loadConversations();
    });
    socket.on(
      "chat:membership-removed",
      (event: { conversationId: string }) => {
        if (event.conversationId === activeConversationIdRef.current) {
          setActiveConversationId("");
          setMessages([]);
          onToast("You no longer have access to that group.");
        }
        void loadConversations();
      }
    );

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
    // Active conversation checks in these event handlers are intentionally based on current page state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, employeeId, loadConversations, onToast]);

  useEffect(() => {
    if (
      initialConversationId &&
      conversations.some((conversation) => conversation.id === initialConversationId)
    ) {
      setActiveConversationId(initialConversationId);
    }
  }, [initialConversationId, conversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setNextCursor(null);
      return;
    }
    let active = true;
    setLoadingMessages(true);
    setError("");
    const previousId = activeConversationId;
    void api
      .getChatMessages(token, activeConversationId)
      .then((result) => {
        if (!active) return;
        setMessages(result.messages);
        setNextCursor(result.nextCursor);
        socketRef.current?.emit("chat:join", {
          conversationId: activeConversationId,
        });
        void api
          .markChatConversationRead(token, activeConversationId)
          .then(() => loadConversations())
          .catch(() => undefined);
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
        });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load this conversation."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => {
      active = false;
      socketRef.current?.emit("chat:leave", { conversationId: previousId });
    };
  }, [activeConversationId, token, loadConversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startDirectConversation = async (employee: ChatEmployee) => {
    try {
      const result = await api.createDirectChat(token, employee.id);
      await loadConversations();
      setActiveConversationId(result.conversation.id);
    } catch (startError) {
      onToast(
        startError instanceof Error
          ? startError.message
          : "Could not start the conversation."
      );
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeConversation || !draft.trim() || sending) return;
    setSending(true);
    setError("");
    const content = draft.trim();
    setDraft("");
    socketRef.current?.emit("chat:typing", {
      conversationId: activeConversation.id,
      isTyping: false,
    });
    try {
      const result = await api.sendChatMessage(
        token,
        activeConversation.id,
        content
      );
      setMessages((previous) =>
        previous.some((message) => message.id === result.message.id)
          ? previous
          : [...previous, result.message]
      );
      void loadConversations();
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    } catch (sendError) {
      setDraft(content);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send the message."
      );
    } finally {
      setSending(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!activeConversationId || !nextCursor) return;
    const result = await api.getChatMessages(
      token,
      activeConversationId,
      nextCursor
    );
    setMessages((previous) => [...result.messages, ...previous]);
    setNextCursor(result.nextCursor);
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedMembers.length < 1) {
      onToast("Select at least one employee for the group.");
      return;
    }
    try {
      const result = await api.createChatGroup(token, {
        name: groupName,
        description: groupDescription,
        memberIds: selectedMembers,
      });
      setShowGroupForm(false);
      setGroupName("");
      setGroupDescription("");
      setSelectedMembers([]);
      await loadConversations();
      setActiveConversationId(result.conversation.id);
    } catch (groupError) {
      onToast(
        groupError instanceof Error
          ? groupError.message
          : "Could not create the group."
      );
    }
  };

  const addMember = async () => {
    if (!activeConversation || !newMemberId) return;
    try {
      await api.addChatGroupMember(
        token,
        activeConversation.id,
        newMemberId,
        newMemberIsAdmin
      );
      setNewMemberId("");
      setNewMemberIsAdmin(false);
      await loadConversations();
      onToast("Employee added to the group.");
    } catch (addError) {
      onToast(
        addError instanceof Error ? addError.message : "Could not add the employee."
      );
    }
  };

  const removeMember = async (memberId: string) => {
    if (!activeConversation || !window.confirm("Remove this employee from the group?")) {
      return;
    }
    try {
      await api.removeChatGroupMember(
        token,
        activeConversation.id,
        memberId
      );
      await loadConversations();
      onToast("Employee removed from the group.");
    } catch (removeError) {
      onToast(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove the employee."
      );
    }
  };

  const leaveGroup = async () => {
    if (!activeConversation || !window.confirm("Leave this group?")) return;
    try {
      await api.leaveChatGroup(token, activeConversation.id);
      setActiveConversationId("");
      setMessages([]);
      await loadConversations();
      onToast("You left the group.");
    } catch (leaveError) {
      onToast(
        leaveError instanceof Error ? leaveError.message : "Could not leave the group."
      );
    }
  };

  const updateReaction = async (message: ChatMessageItem, emoji: string) => {
    const existing = message.reactions.find(
      (reaction) => reaction.emoji === emoji && reaction.reactedByMe
    );
    try {
      const result = await api.setChatReaction(
        token,
        message.id,
        existing ? null : emoji
      );
      setMessages((previous) =>
        previous.map((item) =>
          item.id === message.id
            ? { ...item, reactions: result.reactions }
            : item
        )
      );
    } catch (reactionError) {
      onToast(
        reactionError instanceof Error
          ? reactionError.message
          : "Could not update the reaction."
      );
    }
  };

  const updateTyping = (value: string) => {
    setDraft(value);
    if (activeConversation && socketRef.current?.connected) {
      socketRef.current.emit("chat:typing", {
        conversationId: activeConversation.id,
        isTyping: Boolean(value.trim()),
      });
    }
  };

  return (
    <section className="internal-chat">
      <header className="internal-chat-heading">
        <div>
          <span className="internal-chat-eyebrow">VaultBank • Employee workspace</span>
          <h1>Internal Messages</h1>
          <p>Private conversations for authorized bank employees.</p>
        </div>
        <div className={`chat-connection ${connectionState}`}>
          <Circle size={9} fill="currentColor" />
          {connectionState === "connected"
            ? "Live"
            : connectionState === "connecting"
              ? "Connecting"
              : "Reconnecting"}
        </div>
      </header>

      {error && (
        <div className="chat-error" role="alert">
          {error}
          <button type="button" aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-actions">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations or employees"
              aria-label="Search conversations and employees"
            />
            <button
              type="button"
              className="chat-icon-button"
              onClick={() => setShowGroupForm(true)}
              aria-label="Create employee group"
              title="Create group"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="chat-sidebar-scroll">
            <h2>Conversations</h2>
            {loading ? (
              <p className="chat-muted"><LoaderCircle className="chat-spin" size={15} /> Loading…</p>
            ) : visibleConversations.length === 0 ? (
              <p className="chat-muted">No conversations yet. Search employees to start one.</p>
            ) : (
              visibleConversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`chat-conversation-item ${
                    activeConversationId === conversation.id ? "active" : ""
                  }`}
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <span className="chat-avatar">
                    {conversation.type === "group" ? (
                      <Users size={17} />
                    ) : (
                      getInitials(conversation.name)
                    )}
                  </span>
                  <span className="chat-conversation-text">
                    <span className="chat-conversation-title">
                      {conversation.name}
                    </span>
                    <span className="chat-conversation-preview">
                      {conversation.lastMessagePreview || "No messages yet"}
                    </span>
                  </span>
                  <span className="chat-conversation-meta">
                    {conversation.lastMessageAt && (
                      <time>{displayTime(conversation.lastMessageAt)}</time>
                    )}
                    {conversation.unreadCount > 0 && (
                      <b aria-label={`${conversation.unreadCount} unread messages`}>
                        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                      </b>
                    )}
                  </span>
                </button>
              ))
            )}

            <h2 className="chat-directory-heading">Employees</h2>
            {visibleEmployees.length === 0 ? (
              <p className="chat-muted">No employees match this search.</p>
            ) : (
              visibleEmployees.map((employee) => (
                <button
                  type="button"
                  className="chat-employee-item"
                  key={employee.id}
                  onClick={() => void startDirectConversation(employee)}
                >
                  <span className="chat-avatar small">
                    {getInitials(employee.name)}
                    <i className={employee.online ? "online" : ""} />
                  </span>
                  <span>
                    <strong>{employee.name}</strong>
                    <small>
                      {employee.role}
                      {employee.employeeId ? ` · ${employee.employeeId}` : ""}
                    </small>
                  </span>
                  <MessageCircle size={15} />
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="chat-main" aria-label="Conversation">
          {!activeConversation ? (
            <div className="chat-empty">
              <MessageCircle size={36} />
              <h2>Your conversations</h2>
              <p>Choose an employee or conversation to start a secure internal chat.</p>
            </div>
          ) : (
            <>
              <header className="chat-conversation-header">
                <span className="chat-avatar">
                  {activeConversation.type === "group" ? (
                    <Users size={17} />
                  ) : (
                    getInitials(activeConversation.name)
                  )}
                </span>
                <div>
                  <h2>{activeConversation.name}</h2>
                  <span>
                    {activeConversation.type === "group"
                      ? `${activeConversation.participantCount} members`
                      : activeConversation.participants.find(
                          (participant) => participant.id !== employeeId
                        )?.online
                        ? "Online"
                        : "Employee conversation"}
                  </span>
                </div>
                {activeConversation.type === "group" && (
                  <button
                    type="button"
                    className="btn btn-secondary chat-manage-button"
                    onClick={() => setShowMemberManager((value) => !value)}
                  >
                    <Users size={15} /> Members
                  </button>
                )}
              </header>

              {showMemberManager && activeConversation.type === "group" && (
                <div className="chat-member-manager">
                  <div className="chat-member-list">
                    {activeConversation.participants.map((participant) => (
                      <div key={participant.id}>
                        <span>
                          {participant.name}
                          <small>
                            {participant.role}
                            {participant.isAdmin ? " · Admin" : ""}
                          </small>
                        </span>
                        {activeConversation.isAdmin &&
                          participant.id !== employeeId && (
                            <button
                              type="button"
                              className="chat-text-button danger"
                              onClick={() => void removeMember(participant.id)}
                            >
                              Remove
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                  {activeConversation.isAdmin && (
                    <div className="chat-add-member">
                      <select
                        value={newMemberId}
                        onChange={(event) => setNewMemberId(event.target.value)}
                        aria-label="Select employee to add"
                      >
                        <option value="">Add an employee…</option>
                        {employees
                          .filter(
                            (employee) =>
                              !activeConversation.participants.some(
                                (participant) => participant.id === employee.id
                              )
                          )
                          .map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name} · {employee.role}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!newMemberId}
                        onClick={() => void addMember()}
                      >
                        Add
                      </button>
                    </div>
                  )}
                  {activeConversation.isAdmin && (
                    <label className="chat-promote-member">
                      <input
                        type="checkbox"
                        checked={newMemberIsAdmin}
                        onChange={(event) =>
                          setNewMemberIsAdmin(event.target.checked)
                        }
                      />
                      Make the new member a group admin
                    </label>
                  )}
                  <button
                    type="button"
                    className="chat-text-button danger"
                    onClick={() => void leaveGroup()}
                  >
                    Leave group
                  </button>
                </div>
              )}

              <div className="chat-message-list" ref={scrollRef}>
                {nextCursor && (
                  <button
                    type="button"
                    className="chat-load-older"
                    onClick={() => void loadOlderMessages()}
                  >
                    <ArrowDown size={14} /> Load older messages
                  </button>
                )}
                {loadingMessages ? (
                  <div className="chat-empty compact">
                    <LoaderCircle className="chat-spin" size={22} />
                    Loading messages…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty compact">
                    <p>No messages yet. Start the conversation.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender.id === employeeId;
                    return (
                      <article
                        key={message.id}
                        className={`chat-message ${mine ? "mine" : ""}`}
                      >
                        {!mine && (
                          <span className="chat-avatar message-avatar">
                            {getInitials(message.sender.name)}
                          </span>
                        )}
                        <div className="chat-message-body">
                          <div className="chat-message-meta">
                            {!mine && (
                              <strong>
                                {message.sender.name}
                                {activeConversation.type === "group" &&
                                  ` · ${message.sender.role}`}
                              </strong>
                            )}
                            <time>{displayTime(message.createdAt)}</time>
                          </div>
                          <div className="chat-bubble">{message.content}</div>
                          <div className="chat-reactions">
                            {message.reactions.map((reaction) => (
                              <button
                                type="button"
                                key={reaction.emoji}
                                className={reaction.reactedByMe ? "reacted" : ""}
                                onClick={() => void updateReaction(message, reaction.emoji)}
                                aria-label={`${reaction.emoji} reaction, ${reaction.count} people`}
                              >
                                {reaction.emoji} {reaction.count}
                              </button>
                            ))}
                            <details className="chat-reaction-picker">
                              <summary aria-label="React to message">☺</summary>
                              <div>
                                {REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    type="button"
                                    key={emoji}
                                    aria-label={`React ${emoji}`}
                                    onClick={() => void updateReaction(message, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </details>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="chat-compose-area">
                {typingName && (
                  <div className="chat-typing" aria-live="polite">
                    {typingName} is typing…
                  </div>
                )}
                <p className="chat-privacy-note">
                  Do not share passwords, one-time codes, account or card numbers,
                  balances, or KYC documents in chat.
                </p>
                <form className="chat-compose" onSubmit={sendMessage}>
                  <textarea
                    value={draft}
                    onChange={(event) => updateTyping(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    maxLength={4000}
                    rows={2}
                    placeholder="Write a message…"
                    aria-label="Message"
                    disabled={sending || connectionState !== "connected"}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!draft.trim() || sending || connectionState !== "connected"}
                    aria-label="Send message"
                  >
                    {sending ? <LoaderCircle className="chat-spin" size={17} /> : <Send size={17} />}
                    Send
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      {showGroupForm && (
        <div
          className="chat-modal-overlay"
          role="presentation"
          onClick={() => setShowGroupForm(false)}
        >
          <form
            className="chat-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={createGroup}
          >
            <header>
              <div>
                <h2 id="create-group-title">Create employee group</h2>
                <p>Only authorized employees can join this conversation.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShowGroupForm(false)}>
                <X size={18} />
              </button>
            </header>
            <label>
              Group name
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label>
              Description (optional)
              <input
                value={groupDescription}
                onChange={(event) => setGroupDescription(event.target.value)}
                maxLength={250}
              />
            </label>
            <fieldset>
              <legend>Members (select at least one)</legend>
              <div className="chat-group-employee-list">
                {employees.map((employee) => (
                  <label key={employee.id}>
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(employee.id)}
                      onChange={(event) =>
                        setSelectedMembers((previous) =>
                          event.target.checked
                            ? [...previous, employee.id]
                            : previous.filter((id) => id !== employee.id)
                        )
                      }
                    />
                    {employee.name} · {employee.role}
                  </label>
                ))}
              </div>
            </fieldset>
            <footer>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowGroupForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Check size={16} /> Create group
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
