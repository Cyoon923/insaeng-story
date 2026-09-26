"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe, postApp } from "@/lib/client/api";
import {
  AGENT_SEEN_EVENT,
  fetchUnseenAgentReply,
  requestOpenAgentChat,
} from "@/lib/client/chatAgentUnseen";
import type { AppNotification, NotificationSettings } from "@/lib/types/app";

const ITEMS = [
  {
    id: "order" as const,
    title: "주문·제작 진행 알림",
    desc: "신청접수, 제작중, 완성/전달 상태를 알려드립니다.",
  },
  {
    id: "consult" as const,
    title: "상담 일정 알림",
    desc: "1:1 사주상담 일정과 진행 상황을 알려드립니다.",
  },
  {
    id: "notice" as const,
    title: "공지사항 알림",
    desc: "이용 안내와 새로운 소식을 알려드립니다.",
  },
];

function formatDate(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

export default function NotificationsPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [on, setOn] = useState<NotificationSettings>({
    order: true,
    consult: true,
    notice: false,
  });
  const [notes, setNotes] = useState<AppNotification[]>([]);
  // 아직 보지 못한 상담원 답변이 있는지. 도령 버튼·상단 종과 같은 판정 하나를 그대로 쓴다.
  // 기존 알림 기록(AppNotification)과 섞지 않는다. 저장되는 기록이 아니라 지금의 상태다.
  const [agentUnseen, setAgentUnseen] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setLoggedIn(Boolean(data.user));
      if (data.notificationSettings) setOn(data.notificationSettings);
      setNotes(data.notifications ?? []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    // 화면에 붙을 때 한 번만 묻는다(polling·화면 전환 감시 없음).
    let alive = true;
    fetchUnseenAgentReply().then((unseen) => {
      if (alive) setAgentUnseen(unseen);
    });
    // 도령이에서 상담원 대화를 실제로 확인해 읽음이 적히면 이 항목도 함께 사라진다.
    // 이 화면은 읽음을 적지 않는다(들어온 것만으로도, 항목을 누른 것만으로도 읽음이 아니다).
    const onSeen = () => setAgentUnseen(false);
    window.addEventListener(AGENT_SEEN_EVENT, onSeen);
    return () => {
      alive = false;
      window.removeEventListener(AGENT_SEEN_EVENT, onSeen);
    };
  }, []);

  const toggle = async (id: keyof NotificationSettings) => {
    const next = { ...on, [id]: !on[id] };
    setOn(next);
    if (loggedIn) {
      await postApp({ action: "updateNotifications", ...next });
    }
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="알림 설정" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">알림 설정</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          받고 싶은 알림만 켜 두세요. 신청·상담이 접수되면 MY 알림 목록에 남습니다.
        </p>
      </section>

      <div className="space-y-3 px-4 pb-6">
        {ITEMS.map((item) => {
          const active = on[item.id];
          return (
            <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-[#403A49]">{item.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">{item.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={item.title}
                onClick={() => toggle(item.id)}
                className={`relative h-8 w-14 shrink-0 rounded-full ${
                  active ? "bg-[#403A49]" : "bg-[#d4c8ba]"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] ${
                    active ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          );
        })}
        {loaded && !loggedIn ? (
          <p className="text-center text-[13px] text-[#6B6570]">
            알림 기록은 로그인 후 저장됩니다.{" "}
            <Link href="/login" className="font-semibold text-[#403A49]">
              로그인하기
            </Link>
          </p>
        ) : null}
      </div>

      <section className="px-4 pb-8">
        {/*
          도령 상담원 답변. 기록이 아니라 지금 확인하지 않은 답변이 있다는 표시이므로
          아래 알림 기록 목록과 섞지 않고 위에 따로 둔다. 누르면 도령이 대화가 열린다.
        */}
        {agentUnseen ? (
          <button
            type="button"
            onClick={() => requestOpenAgentChat()}
            className="mb-3 block w-full rounded-2xl bg-white p-4 text-left ring-1 ring-[#403A49]"
          >
            <p className="text-[16px] font-bold text-[#403A49]">도령 상담원 답변이 도착했어요</p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">
              새 답변을 확인해 주세요.
            </p>
          </button>
        ) : null}

        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">알림 기록</h3>
        {notes.length === 0 && !agentUnseen ? (
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            아직 받은 알림이 없습니다.
          </p>
        ) : notes.length === 0 ? (
          // 위 도령 항목만 있는 경우다. "받은 알림이 없다"고 적지 않고, 기록 쪽만 짧게 알린다.
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            이 밖에 받은 알림은 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
                <p className="text-[16px] font-bold text-[#403A49]">{note.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">{note.body}</p>
                <p className="mt-2 text-[12px] text-[#6B6570]">{formatDate(note.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </MobileShell>
  );
}
