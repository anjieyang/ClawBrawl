'use client';

import React from 'react';
import { Tooltip } from '@nextui-org/react';
import { getTagDefinition, type TagDefinition } from '@/lib/tags';

interface AgentTagProps {
  tagId: string;
  size?: 'xs' | 'sm' | 'md';
  showEmoji?: boolean;
  showTooltip?: boolean;
  className?: string;
}

/**
 * 单个标签组件
 */
export function AgentTag({ 
  tagId, 
  size = 'sm', 
  showEmoji = true, 
  showTooltip = true,
  className = '' 
}: AgentTagProps) {
  const tag = getTagDefinition(tagId);
  
  if (!tag) return null;
  
  const sizeClasses = {
    xs: 'text-[8px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };
  
  const content = (
    <span 
      className={`
        inline-flex items-center rounded-full font-bold uppercase tracking-wider
        ${tag.colors.bg} ${tag.colors.text}
        ${tag.colors.glow || ''}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showEmoji && <span>{tag.emoji}</span>}
      <span>{tag.label}</span>
    </span>
  );
  
  if (!showTooltip) return content;
  
  return (
    <Tooltip
      content={tag.tooltip}
      classNames={{
        base: 'bg-zinc-900 border border-white/10',
        content: 'text-xs text-white/80',
      }}
    >
      {content}
    </Tooltip>
  );
}

interface AgentTagsProps {
  tags: string[];
  maxTags?: number;
  size?: 'xs' | 'sm' | 'md';
  showEmoji?: boolean;
  className?: string;
}

/**
 * 标签列表组件
 */
export function AgentTags({ 
  tags, 
  maxTags = 3, 
  size = 'sm',
  showEmoji = true,
  className = '' 
}: AgentTagsProps) {
  if (!tags || tags.length === 0) return null;
  
  const displayTags = tags.slice(0, maxTags);
  
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {displayTags.map(tagId => (
        <AgentTag 
          key={tagId} 
          tagId={tagId} 
          size={size}
          showEmoji={showEmoji}
        />
      ))}
    </div>
  );
}

/**
 * 紧凑版标签（只显示 emoji，用于表格等空间有限的地方）
 */
export function AgentTagCompact({ tagId }: { tagId: string }) {
  const tag = getTagDefinition(tagId);
  
  if (!tag) return null;
  
  return (
    <Tooltip
      content={
        <div className="text-xs">
          <span className="font-bold">{tag.label}</span>
          <span className="text-white/60 ml-1">- {tag.tooltip}</span>
        </div>
      }
      classNames={{
        base: 'bg-zinc-900 border border-white/10',
      }}
    >
      <span 
        className={`
          inline-flex items-center justify-center w-5 h-5 rounded-full text-xs
          ${tag.colors.bg}
          cursor-help
        `}
      >
        {tag.emoji}
      </span>
    </Tooltip>
  );
}

/**
 * 紧凑版标签列表
 */
export function AgentTagsCompact({ tags, maxTags = 2 }: { tags: string[]; maxTags?: number }) {
  if (!tags || tags.length === 0) return null;
  
  const displayTags = tags.slice(0, maxTags);
  
  return (
    <div className="flex items-center gap-1">
      {displayTags.map(tagId => (
        <AgentTagCompact key={tagId} tagId={tagId} />
      ))}
    </div>
  );
}
