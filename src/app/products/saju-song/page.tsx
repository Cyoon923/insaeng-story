import { ProductDetailPage } from "@/components/products/ProductDetailPage";
import { Grid3X3, Mic, Music, Play } from "lucide-react";

const config = {
  slug: "saju-song",
  title: "사주 인생곡",
  badge: "사주 정보만 입력하면 OK!",
  heroImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop",
  description: "상담 없이 생년월일·태어난 시간 등 사주 정보만으로 인생곡을 제작합니다. 기본 가사 영상 포함.",
  features: [
    { icon: <Grid3X3 className="h-5 w-5" />, label: "사주 분석", sub: "운명 흐름" },
    { icon: <Mic className="h-5 w-5" />, label: "메시지 구성", sub: "자동 구성" },
    { icon: <Music className="h-5 w-5" />, label: "인생곡 제작", sub: "맞춤 음악" },
    { icon: <Play className="h-5 w-5" />, label: "가사 영상", sub: "기본 제공" },
  ],
  priceFrom: 199000,
  applyHref: "/apply/saju-song/1",
  recommends: [
    {
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=300&fit=crop",
      title: "나만을 위한 특별한 노래를 원하시는 분",
    },
    {
      image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
      title: "새로운 시작에 힘이 필요하신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=300&fit=crop",
      title: "부모님이나 가족에게 노래를 선물하고 싶으신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1455396577869-51adff057779?w=400&h=300&fit=crop",
      title: "긴 상담이 부담스러우신 분",
    },
  ],
  process: [
    { num: "01", title: "사주 정보 입력", desc: "생년월일·시간을 입력합니다" },
    { num: "02", title: "사주 분석", desc: "사주 특성을 분석합니다" },
    { num: "03", title: "노래 내용 구성", desc: "메시지를 구성합니다" },
    { num: "04", title: "인생곡 제작", desc: "맞춤 곡을 제작합니다" },
    { num: "05", title: "완성·전달", desc: "음원과 가사 영상을 전달합니다" },
  ],
  faqs: [
    {
      question: "사주 정보는 어떻게 제공하나요?",
      answer: "신청 시 생년월일, 태어난 시간, 성별 등을 입력해 주시면 됩니다.",
    },
    {
      question: "기본으로 제공되는 영상은?",
      answer: "가사만 포함된 영상이 기본 제공됩니다. 추억사진 영상이나 AI 뮤직비디오는 추가 옵션입니다.",
    },
    {
      question: "제작 기간은?",
      answer: "결제 완료 후 평균 5~7일 정도 소요됩니다.",
    },
    {
      question: "상담 없이도 가능한가요?",
      answer: "네, 사주 인생곡은 별도 상담 없이 사주 정보만으로 제작됩니다.",
    },
  ],
};

export default function SajuSongProductPage() {
  return <ProductDetailPage config={config} />;
}
