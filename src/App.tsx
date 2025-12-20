// import { motion } from 'motion/react'

// import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
// import { AuroraBackground } from '@/components/ui/aurora-background'
// import { TypewriterEffectSmooth } from '@/components/ui/typewriter-effect'
'use client'
import { Bluetooth, MonitorPlay, Usb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import SplashCursor from './components/SplashCursor'

import ParticleOrbitEffect from '@/components/lightswind/particle-orbit-effect'
import CodeHoverCards from '@/components/lightswind/code-hover-cards'
import { BackgroundLines } from '@/components/ui/background-lines'
import ColourfulText from '@/components/ui/colourful-text'
import { AuroraText } from '@/components/ui/aurora-text'

const App = () => {
  const navigate = useNavigate()

  const cards = [
    {
      id: '1',
      icon: Usb,
      title: (
        // <AuroraText
        //   colors={[
        //     '#FF3CAC',
        //     '#784BA0',
        //     '#2B86C5',
        //     '#00C9FF',
        //     '#92FE9D',
        //     '#F6D365',
        //     '#FDA085',
        //     '#A18CD1',
        //     '#FBC8D4',
        //     '#FF9A9E',
        //   ]}
        // >
        //   <span id="usb">USB</span>
        // </AuroraText>
        'USB'
      ),
    },
    {
      id: '2',
      icon: Bluetooth,
      title: (
        // <AuroraText
        //   colors={[
        //     '#00F5A0',
        //     '#00D9F5',
        //     '#00B5FF',
        //     '#7F7BFF',
        //     '#B06AB3',
        //     '#F857A6',
        //     '#FF5858',
        //     '#FFC371',
        //     '#F4E04D',
        //     '#9CECFB',
        //   ]}
        // >
        //   <span id="bluetooth">Bluetooth</span>
        // </AuroraText>
        'BLE'
      ),
    },
    {
      id: '3',
      icon: MonitorPlay,
      title: (
        // <AuroraText
        //   colors={[
        //     '#FF512F',
        //     '#F09819',
        //     '#FAD961',
        //     '#2AF598',
        //     '#00CDAC',
        //     '#2193B0',
        //     '#6DD5ED',
        //     '#B3FFAB',
        //     '#DCE35B',
        //     '#45B649',
        //   ]}
        // >
        //   <span id="demo-mode">Demo Mode</span>
        // </AuroraText>
        'Demo Mode'
      ),
    },
  ]

  const handleCardClick = (card: { id: string }) => {
    if (card.id === '3') {
      navigate('/DemoMode')
    }
  }

  return (
    <BackgroundLines
      className="flex items-center justify-center w-full flex-col px-4"
      svgOptions={{ duration: 5 }}
    >
      {/* <SplashCursor /> */}
      <ParticleOrbitEffect />
      {/* <h2 className="bg-clip-text text-transparent text-center bg-gradient-to-b from-neutral-900 to-neutral-700 dark:from-neutral-600 dark:to-white text-2xl md:text-4xl lg:text-7xl font-sans py-2 md:py-10 relative z-20 font-bold tracking-tight">
        Sanjana Airlines, <br /> Sajana Textiles.
      </h2>
      <p className="max-w-xl mx-auto text-sm md:text-lg text-neutral-700 dark:text-neutral-400 text-center">
        Get the best advices from our experts, including expert artists,
        painters, marathon enthusiasts and RDX, totally free.
      </p> */}

      <h1 className="text-2xl md:text-5xl lg:text-7xl font-bold text-center text-neutral-900 dark:text-white relative z-2 font-sans">
        Welcome to <ColourfulText text="WebHMI" />
      </h1>
      <div className="w-full max-w-xl mt-8">
        <CodeHoverCards
          cards={cards}
          maskRadius={160}
          characterCount={800}
          iconSize={32}
          borderRadius={26}
          minHeight={100}
          cardGap="3rem"
          className="bg-transparent"
          columns={3}
          enableTouch={true}

          onCardClick={handleCardClick}
          onCardHover={(card) => console.warn('Hover:', card)}
        />
      </div>

       {/* <LayoutTextFlip
          text="Welcome to "
          words={['USB', 'BLE']}
        /> */}

      {/* <div>
        <BrowserWindow variant="chrome" headerStyle="full" url="https://app.example.com" size="md">
          <div className="h-full w-full bg-background">
            <div className="h-full w-full bg-[radial-gradient(closest-side_at_30%_20%,rgba(0,0,0,0.06),rgba(0,0,0,0)_60%)] dark:bg-[radial-gradient(closest-side_at_30%_20%,rgba(255,255,255,0.08),rgba(0,0,0,0)_60%)]">
              <div className="h-full w-full p-2">
                <MockHidConnectDialog className="h-1/2 w-1/2" />
              </div>
            </div>
          </div>
        </BrowserWindow>
      </div> */}
      
    </BackgroundLines>
  )
}

export default App
