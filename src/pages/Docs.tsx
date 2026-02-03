import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

// Load markdown files
const markdownFiles = import.meta.glob('../docs/*.md', { query: '?raw', import: 'default', eager: true })

const data = {
  navMain: [
    {
      title: "Getting Started",
      items: [
        {
          title: "User Guide",
          slug: "user-guide",
        },
        {
          title: "Supported Devices",
          slug: "supported-devices",
        },
      ],
    },
    {
      title: "Resources",
      items: [
        {
          title: "FAQ",
          slug: "faq",
        },
      ],
    },
  ],
}




interface DocsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeSlug: string
  onSelect: (slug: string) => void
}

function DocsSidebar({ activeSlug, onSelect, ...props }: DocsSidebarProps) {
  return (
    <Sidebar
      {...props}
      className="sticky top-0 h-screen overflow-y-auto border-none group-data-[side=left]:border-none bg-transparent"
      style={{ "--sidebar-background": "transparent" } as React.CSSProperties}
    >

      <SidebarContent>
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={activeSlug === item.slug}
                      onClick={() => onSelect(item.slug)}
                      className="cursor-pointer"
                    >
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

// Extract headings from markdown content
const extractHeadings = (markdown: string) => {
  const headings: { id: string; text: string; level: number }[] = []

  // Normalize line endings and split
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')

  // Simple regex for ATX headings
  const headingRegex = /^(#{2,3})\s+(.+)$/

  lines.forEach((line) => {
    const cleanLine = line.trimEnd()
    const match = cleanLine.match(headingRegex)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      // Use a more robust slug generation that supports Chinese
      // github-slugger style: lowercase, replace spaces with -, remove special chars but keep CJK
      const id = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af-]/g, '') // Keep alphanumeric, CJK characters and hyphens
      headings.push({ id, text, level })
    }
  })
  return headings
}


import { cn } from "@/lib/utils"

export default function Docs() {
  const [activeSlug, setActiveSlug] = React.useState("user-guide")
  const [activeId, setActiveId] = React.useState<string>("")

  const content = React.useMemo(() => {
    const path = `../docs/${activeSlug}.md`
    return (markdownFiles[path] as string) || `# Error\n\nDocument not found: ${activeSlug}`
  }, [activeSlug])

  const headings = React.useMemo(() => extractHeadings(content), [content])

  // Set default active ID
  React.useEffect(() => {
    if (headings.length > 0) {
      setActiveId(headings[0].id)
    }
  }, [headings])  // Ported scroll highlight logic from TOC.astro
  React.useEffect(() => {
    const handleScroll = () => {
      if (headings.length === 0) return

      const headingElements = headings
        .map(h => document.getElementById(h.id))
        .filter((el): el is HTMLElement => el !== null)

      if (headingElements.length === 0) return

      // Ported algorithm: find the last heading that has passed the threshold
      const currentHeading = headingElements.reduce((current, el) => {
        const top = el.getBoundingClientRect().top // Relative to viewport
        // 100px is the threshold from TOC.astro
        return top <= 100 ? el : current
      }, headingElements[0])

      if (currentHeading) {
        setActiveId(currentHeading.id)
      }
    }

    let scrollTimeout: number
    const onScroll = () => {
      if (scrollTimeout) window.cancelAnimationFrame(scrollTimeout)
      scrollTimeout = window.requestAnimationFrame(handleScroll)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    handleScroll() // Initial check
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollTimeout) window.cancelAnimationFrame(scrollTimeout)
    }
  }, [headings])

  const activeTitle = React.useMemo(() => {
    for (const group of data.navMain) {
      const item = group.items.find(i => i.slug === activeSlug)
      if (item) return item.title
    }
    return activeSlug
  }, [activeSlug])

  const activeGroupTitle = React.useMemo(() => {
    for (const group of data.navMain) {
      if (group.items.find(i => i.slug === activeSlug)) {
        return group.title
      }
    }
    return "Docs"
  }, [activeSlug])

  return (
    <div className="-mt-10 -mx-4 min-h-screen">
      <SidebarProvider className="min-h-screen">
        <DocsSidebar activeSlug={activeSlug} onSelect={setActiveSlug} />
        <SidebarInset className="min-h-screen bg-transparent">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b md:border-b-0 bg-transparent px-4">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Separator
              orientation="vertical"
              className="mr-2 h-4 md:hidden"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block text-muted-foreground">
                  {activeGroupTitle}
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <div
            className="flex flex-1 relative"
          >
            <div
              className="flex-1 p-6 min-w-0"
            >
              <div className="prose prose-slate dark:prose-invert max-w-3xl mx-auto w-full">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Table of Contents - Fixed Right Column */}
            <div className="hidden xl:block w-72 shrink-0 p-6 sticky top-0 self-start h-fit">
              <div className="text-sm">
                <h4 className="font-medium mb-4 text-foreground/90">On this page</h4>
                <ul className="space-y-2">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className={cn(
                          "block border-l-2 py-1 pr-2 transition-all hover:text-foreground line-clamp-1",
                          activeId === heading.id
                            ? "border-primary font-medium text-foreground"
                            : "border-transparent text-muted-foreground"
                        )}
                        style={{ paddingLeft: (heading.level - 2) * 16 + 12 }}
                        onClick={(e) => {
                          e.preventDefault()
                          const element = document.getElementById(heading.id)
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth' })
                            // Manually set active ID to avoid flicker during smooth scroll
                            setActiveId(heading.id)
                            // Sync URL hash
                            window.history.pushState(null, '', `#${heading.id}`)
                          }
                        }}
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
