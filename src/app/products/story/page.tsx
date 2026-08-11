import { ProductDetailPage, STORY_FEATURES } from "@/components/products/ProductDetailPage";

const config = {
  slug: "story",
  title: "인생곡",
  badge: "이야기로 만드는",
  heroImage: "https://images.unsplash.com/photo-1455396577869-51adff057779?w=800&h=400&fit=crop",
  description: "직접 작성한 이야기를 바탕으로 맞춤 가사와 음악을 제작합니다.",
  features: STORY_FEATURES,
  priceFrom: 149000,
  applyHref: "/apply/story-song/1",
  recommends: [
    {
      image: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=300&fit=crop",
      title: "부모님께 감동을 선물하고 싶으신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=300&fit=crop",
      title: "연인 또는 배우자에게 특별한 마음을 전하고 싶으신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop",
      title: "반려동물과의 추억을 노래로 간직하고 싶으신 분",
    },
    {
      image: "https://images.unsplash.com/photo-1455396577869-51adff057779?w=400&h=300&fit=crop",
      title: "나만의 이야기를 노래로 남기고 싶으신 분",
    },
  ],
  process: [
    { num: "01", title: "신청·문의", desc: "온라인으로 간편하게 신청" },
    { num: "02", title: "스토리상담", desc: "전문 상담사와 이야기를 나눕니다" },
    { num: "03", title: "인생곡 제작", desc: "맞춤 가사와 음악을 제작합니다" },
    { num: "04", title: "뮤직비디오", desc: "감동을 더하는 영상을 만듭니다" },
    { num: "05", title: "완성·전달", desc: "완성된 작품을 전달합니다" },
  ],
  faqs: [
    {
      question: "이야기를 잘 못해도 괜찮을까요?",
      answer: "괜찮습니다. 상담사가 따뜻하게 이끌어 드리며, 질문에 답하시는 것만으로도 충분합니다.",
    },
    {
      question: "노래는 어떤 장르로 만들어지나요?",
      answer: "고객님이 좋아하시는 가수와 노래를 참고하여, 원하시는 분위기에 맞게 제작합니다.",
    },
    {
      question: "제작 기간은 얼마나 걸리나요?",
      answer: "결제 완료 후 평균 7~10일 정도 소요됩니다.",
    },
    {
      question: "수정은 몇 번까지 가능한가요?",
      answer: "기본 가사 수정 1회가 포함되어 있으며, 추가 수정은 옵션으로 선택하실 수 있습니다.",
    },
  ],
};

export default function StoryProductPage() {
  return <ProductDetailPage config={config} />;
}
