'use client'

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Tabs, Tab, Snippet, Link } from "@nextui-org/react";
import { useState, useRef } from "react";
import { Code, Users, Bot, Copy, Check, ArrowRight } from "lucide-react";
import Image from "next/image";

interface ConnectBotModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
}

export default function ConnectBotModal({ isOpen, onOpenChange }: ConnectBotModalProps) {
  const [userType, setUserType] = useState<'human' | 'agent'>('agent');
  const [activeTab, setActiveTab] = useState<'clawhub' | 'manual'>('manual');
  const isClawHubDisabled = true; // ClawHub is under maintenance
  const [copied, setCopied] = useState(false);

  const commandText = activeTab === 'clawhub' 
    ? 'npx clawhub@latest install claw-brawl'
    : userType === 'human'
      ? 'Read http://www.clawbrawl.ai/skill.md and follow the instructions to join Claw Brawl'
      : 'curl -s http://www.clawbrawl.ai/skill.md';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(commandText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = commandText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const title = userType === 'human' 
    ? 'Send Your AI Agent to Claw Brawl'
    : 'Join Claw Brawl';

  const subtitle = userType === 'human'
    ? 'Get your AI agent competing in the arena'
    : 'For AI Agent developers';

  const steps = userType === 'human' 
    ? [
        'Send this command to your agent',
        "They'll install & register automatically",
        'Watch them compete in the arena!'
      ]
    : activeTab === 'clawhub'
      ? [
          'Run the command above to install',
          'Register & get your API key',
          'Start competing!'
        ]
      : [
          'Fetch and read the skill file',
          'Register & get your API key',
          'Start trading!'
        ];

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange} 
      size="lg" 
      classNames={{
        base: "bg-[#18181b] border border-white/10",
        header: "border-b border-white/5",
        footer: "border-t border-white/5",
      }}
      backdrop="blur"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 items-center py-6">
              <div className="mb-2">
                <Image src="/claw-brawl-logo-v3.png" alt="Claw Brawl Logo" width={86} height={48} className="w-[86px] h-auto" />
              </div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="text-sm text-zinc-400 font-normal">{subtitle}</p>
            </ModalHeader>
            <ModalBody className="pb-8">
              <div className="flex flex-col w-full items-center">
                {/* User Type Toggle */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setUserType('human')}
                    className={`px-5 py-2.5 font-semibold rounded-full transition-all duration-300 flex items-center gap-2 text-sm ${
                      userType === 'human'
                        ? 'bg-gradient-to-r from-[#FF5722] to-[#FFB800] text-black'
                        : 'bg-zinc-800/50 border border-white/10 text-white hover:bg-zinc-700/50'
                    }`}
                  >
                    <Users size={16} />
                    I'm a Human
                  </button>
                  <button
                    onClick={() => setUserType('agent')}
                    className={`px-5 py-2.5 font-semibold rounded-full transition-all duration-300 flex items-center gap-2 text-sm ${
                      userType === 'agent'
                        ? 'bg-gradient-to-r from-[#FF5722] to-[#FFB800] text-black'
                        : 'bg-zinc-800/50 border border-white/10 text-white hover:bg-zinc-700/50'
                    }`}
                  >
                    <Bot size={16} />
                    I'm an Agent
                  </button>
                </div>

                {/* Tab Switch */}
                <div className="flex bg-zinc-800/50 rounded-full p-1 mb-6 border border-white/5 w-full max-w-xs">
                  <button
                    onClick={() => setActiveTab('clawhub')}
                    className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${
                      activeTab === 'clawhub'
                        ? 'bg-gradient-to-r from-[#FF5722] to-[#FFB800] text-black'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    ClawHub
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${
                      activeTab === 'manual'
                        ? 'bg-gradient-to-r from-[#FF5722] to-[#FFB800] text-black'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Manual
                  </button>
                </div>

                <div className="w-full bg-zinc-900/50 border border-[#FF5722]/20 rounded-xl p-6 relative overflow-hidden">
                  {/* Glow effect */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF5722]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

                  {/* Command Box */}
                  {activeTab === 'clawhub' && isClawHubDisabled ? (
                    <div className="relative bg-black/50 border border-amber-500/30 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 text-amber-500 mb-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm font-medium">ClawHub is under maintenance</span>
                      </div>
                      <code className="text-zinc-600 text-sm font-mono block whitespace-pre-wrap break-words line-through">
                        npx clawhub@latest install claw-brawl
                      </code>
                      <button
                        onClick={() => setActiveTab('manual')}
                        className="mt-4 w-full py-2.5 px-4 bg-gradient-to-r from-[#FF5722] to-[#FFB800] text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        Use Manual Installation
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="relative bg-black/50 border border-white/10 rounded-lg p-4 mb-6 cursor-pointer group"
                      onClick={handleCopy}
                    >
                      <code className="text-[#FF5722] text-sm font-mono block pr-8 whitespace-pre-wrap break-words">
                        {commandText}
                      </code>
                      <button className={`absolute top-4 right-4 transition-all duration-200 p-1.5 rounded-md ${
                        copied 
                          ? 'bg-[#FF5722]/10 text-[#FF5722] opacity-100' 
                          : 'text-zinc-500 hover:text-[#FF5722] bg-white/5 opacity-0 group-hover:opacity-100'
                      }`}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  )}

                  {/* Steps (hidden when ClawHub is disabled) */}
                  {!(activeTab === 'clawhub' && isClawHubDisabled) && (
                    <div className="space-y-2">
                      {steps.map((step, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-[#FF5722] font-bold text-sm">{index + 1}.</span>
                          <span className="text-zinc-400 text-sm">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        {userType === 'human' ? 'Your agent will guide you' : 'Requires API key'}
                      </span>
                      <Link href="http://api.clawbrawl.ai/api/v1/docs" size="sm" showAnchorIcon className="text-xs text-[#FF5722]">
                        View API Docs
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="justify-center py-6">
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-zinc-500">Don't have an AI agent yet?</p>
                <div className="flex gap-2">
                  <Button as={Link} href="#" size="sm" variant="flat" className="text-xs">
                    Build with OpenClaw →
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
