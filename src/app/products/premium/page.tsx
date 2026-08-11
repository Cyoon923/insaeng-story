import { ProductDetailPage, STORY_FEATURES } from "@/components/products/ProductDetailPage";
import { User, MessageCircle, Music, Clapperboard } from "lucide-react";

const config = {
  slug: "premium",
  title: "프리미엄 인생곡",
  badge: "토탈 맞춤 상담 + 인생곡 + 뮤직비디오",
  heroImage: "https://images.unsplash.com/photo-1549465220-1a391b3ca556?w=800&h=400&fit=crop",
  description: "사주상담과 실제 이야기를 깊게 듣고, 음악과 뮤직비디오까지 제작합니다.",
  features: [
    { icon: <User className="h-5 w-5" />, label: "사주상담", sub: "운명 분석" },
    { icon: <MessageCircle className="h-5 w-5" />, label: "스토리상담", sub: "인생 이야기" },
    { icon: <Music className="h-5 w-5" />, label: "인생곡 제작", sub: "맞춤 음악" },
    { icon: <Clapperboard className="h-5 w-5" />, label: "뮤직비디오", sub: "영상 제작" },
  ],
  priceFrom: 399000,
  applyHref: "/apply/premium/1",
  recommends: [
    {
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop",
      title: "자신의 운명의 흐름을 알고 싶으신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop",
      title: "전문가와 함께 인생 이야기를 정리하고 싶으신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
      title: "인생의 전환점에 의미 있는 노래를 원하시는 분",
    },
    {
      image: "https://images.unsplash.com/photo-1549465220-1a391b3ca556?w=400&h=300&fit=crop",
      title: "부모님이나 가족에게 특별한 선물을 하고 싶으신 분",
    },
  ],
  process: [
    { num: "01", title: "사주상담", desc: "운명과 핵심 키워드를 분석합니다" },
    { num: "02", title: "스토리상담", desc: "감정과 경험을 메시지로 정리합니다" },
    { num: "03", title: "인생곡 제작", desc: "상담 내용을 바탕으로 곡을 만듭니다" },
    { num: "04", title: "뮤직비디오", desc: "노래에 맞는 영상을 제작합니다" },
    { num: "05", title: "완성·전달", desc: "최종 확인 후 전달합니다" },
  ],
  faqs: [
    {
      question: "프리미엄과 일반 인생곡의 차이는?",
      answer: "프리미엄은 사주상담 + 스토리상담 + 인생곡 + 뮤직비디오가 포함된 토탈 서비스입니다.",
    },
    {
      question: "상담은 어떻게 진행되나요?",
      answer: "카카오톡 또는 이메일로 전문 상담사와 1:1 상담을 진행합니다.",
    },
    {
      question: "제작 기간은?",
      answer: "상담 완료 후 평균 10~14일 정도 소요됩니다.",
    },
    {
      question: "수정은 몇 번 가능한가요?",
      answer: "기본 가사 수정 1회가 포함됩니다.",
    },
  ],
};

export default function PremiumProductPage() {
  return <ProductDetailPage config={config} />;
}
