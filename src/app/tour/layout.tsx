import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "기독유적지 투어 신청",
  description: "기독유적지 투어 일정을 확인하고 신청하세요.",
};

export default function TourLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
