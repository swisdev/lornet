type LornetBrandProps = {
  compact?: boolean
  markClassName?: string
  wordClassName?: string
}

const logoSource = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gemini_Generated_Image_7n6m307n6m307n6m-h8fZbuNc3dxbIhf0Hdo0qo4aHgsCkL.jpg'

export function LornetBrand({ compact = false, markClassName = '', wordClassName = '' }: LornetBrandProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ${markClassName}`}>
        <img src={logoSource} alt="" referrerPolicy="no-referrer" decoding="async" className="size-full object-contain mix-blend-multiply" />
      </span>
      {!compact && <span className={`text-[20px] font-semibold tracking-[-.06em] ${wordClassName}`}>lornet<span className="text-emerald-600">.</span></span>}
    </span>
  )
}
