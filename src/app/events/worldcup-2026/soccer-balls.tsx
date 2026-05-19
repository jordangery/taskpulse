"use client"

// 浮在整個 World Cup 頁面上的足球
// 滑鼠靠近會被「踢開」，撞牆會反彈，會慢慢摩擦停下
// pointer-events:none → 不擋下面卡片的點擊，純裝飾互動

import { useEffect, useRef } from "react"

const BALL_COUNT = 24
const HOVER_RADIUS = 90 // 距離 ≤ 這個值才算「滑鼠在踢」
const KICK_FORCE = 16 // 踢力上限
const FRICTION = 0.94 // 每 frame 速度衰減
const EDGE_DAMP = 0.6 // 撞牆反彈衰減

interface BallPhysics {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  size: number
}

export function SoccerBalls() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const ballElsRef = useRef<(HTMLDivElement | null)[]>([])
  const physicsRef = useRef<BallPhysics[]>([])
  const mouseRef = useRef({ x: -10000, y: -10000 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 用 viewport 尺寸初始化球的位置 / 大小 / 初速度
    const initBalls = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      physicsRef.current = Array.from({ length: BALL_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        rot: Math.random() * 360,
        size: 18 + Math.random() * 16, // 18 ~ 34px
      }))
    }
    initBalls()

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const handleMouseLeave = () => {
      mouseRef.current = { x: -10000, y: -10000 }
    }
    const handleResize = () => initBalls()

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    window.addEventListener("mouseleave", handleMouseLeave)
    window.addEventListener("resize", handleResize)

    let raf = 0
    const loop = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const mouse = mouseRef.current
      const balls = physicsRef.current

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i]
        if (!b) continue

        // 踢力：距離越近越強，方向是「球 → 反方向遠離滑鼠」
        const dx = b.x - mouse.x
        const dy = b.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < HOVER_RADIUS && dist > 0.1) {
          const force = ((HOVER_RADIUS - dist) / HOVER_RADIUS) * KICK_FORCE
          b.vx += (dx / dist) * force
          b.vy += (dy / dist) * force
        }

        // 移動 + 自轉（轉速跟速度成正比，讓視覺有滾動感）
        b.x += b.vx
        b.y += b.vy
        b.rot += b.vx * 3

        // 摩擦
        b.vx *= FRICTION
        b.vy *= FRICTION

        // 撞牆反彈
        const margin = b.size / 2
        if (b.x < margin) {
          b.x = margin
          b.vx = Math.abs(b.vx) * EDGE_DAMP
        } else if (b.x > w - margin) {
          b.x = w - margin
          b.vx = -Math.abs(b.vx) * EDGE_DAMP
        }
        if (b.y < margin) {
          b.y = margin
          b.vy = Math.abs(b.vy) * EDGE_DAMP
        } else if (b.y > h - margin) {
          b.y = h - margin
          b.vy = -Math.abs(b.vy) * EDGE_DAMP
        }

        // 直接寫 transform，不走 React state（25 顆球 60fps 太貴）
        const el = ballElsRef.current[i]
        if (el) {
          el.style.transform = `translate3d(${b.x - b.size / 2}px, ${b.y - b.size / 2}px, 0) rotate(${b.rot}deg)`
          el.style.fontSize = `${b.size}px`
        }
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseleave", handleMouseLeave)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      // z-60：蓋在 World Cup 頁(z-50)之上，但 pointer-events:none 所以不擋互動
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden
    >
      {Array.from({ length: BALL_COUNT }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: 24 顆球永久同個位置渲染，index 是穩定 key
          key={i}
          ref={(el) => {
            ballElsRef.current[i] = el
          }}
          className="absolute select-none leading-none"
          style={{
            top: 0,
            left: 0,
            willChange: "transform",
            filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6))",
            // 初始藏到畫面外，等第一個 RAF tick 把它推回來
            transform: "translate3d(-1000px, -1000px, 0)",
          }}
        >
          ⚽
        </div>
      ))}
    </div>
  )
}
