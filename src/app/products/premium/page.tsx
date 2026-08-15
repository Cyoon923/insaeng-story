import { ProductDetailPage } from "@/components/products/ProductDetailPage";
import { User, MessageCircle, Music, Clapperboard } from "lucide-react";

const config = {
  slug: "premium",
  title: "프리미엄 인생곡",
  badge: "토탈 맞춤 상담 + 인생곡 + 뮤직비디오",
  heroImage: "/images/photo-premium-life.png",
  description:
    "사주상담, 스토리상담, 인생곡 제작, 뮤직비디오까지 한 번에 진행하는 토탈 서비스입니다.",
  features: [
    { icon: <User className="h-5 w-5" />, label: "사주상담", sub: "심층 분석" },
    { icon: <MessageCircle className="h-5 w-5" />, label: "스토리상담", sub: "인생 이야기" },
    { icon: <Music className="h-5 w-5" />, label: "인생곡 제작", sub: "맞춤 음악" },
    { icon: <Clapperboard className="h-5 w-5" />, label: "뮤직비디오", sub: "영상 제작" },
  ],
  priceFrom: 399000,
  applyHref: "/apply/premium/1",
  recommends: [
    {
      image: "/images/photo-tea.jpg",
      title: "사주로 나의 흐름을 알고 싶으신 분",
    },
    {
      image: "/images/life-graph-radar.png",
      title: "선생님과 함께 인생 이야기를 정리하고 싶으신 분",
    },
    {
      image: "/images/photo-hero.jpg",
      title: "인생의 전환점에 의미 있는 노래를 원하시는 분",
    },
    {
      image: "/images/photo-parents.jpg",
      title: "부모님이나 가족에게 특별한 선물을 하고 싶으신 분",
    },
  ],
  process: [
    { num: "01", title: "사주상담", desc: "사주 흐름과 핵심 메시지를 살펴봅니다" },
    { num: "02", title: "스토리상담", desc: "감정과 추억을 이야기로 정리합니다" },
    { num: "03", title: "인생곡 제작", desc: "상담 내용을 바탕으로 곡을 만듭니다" },
    { num: "04", title: "뮤직비디오", desc: "노래에 맞는 영상을 제작합니다" },
    { num: "05", title: "완성·전달", desc: "완성된 작품을 전달합니다" },
  ],
  faqs: [
    {
      question: "프리미엄과 일반 인생곡의 차이는?",
      answer: "프리미엄은 일반 인생곡의 고급형이 아닙니다. 사주상담, 스토리상담, 인생곡, 뮤직비디오가 포함된 토탈 서비스입니다. 전문 보컬 녹음은 포함되지 않습니다.",
    },
    {
      question: "상담은 어떻게 진행되나요?",
      answer: "카카오톡 또는 전화로 선생님과 1:1 상담을 진행합니다.",
    },
    {
      question: "제작 기간은?",
      answer: "상담 완료 후 평균 10~14일 정도 소요됩니다.",
    },
    {
      question: "수정은 몇 번 가능한가요?",
      answer: "기본 가사 수정 1회가 포함됩니다.",
    },
    {
      question: "완성된 노래와 영상은 어떻게 받나요?",
      answer: "음원 파일과 뮤직비디오를 전달해 드립니다.",
    },
  ],
};

export default function PremiumProductPage() {
  return <ProductDetailPage config={config} />;
}
