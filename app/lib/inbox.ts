/** Inbox item presentation (SCREENS §1.4, API.md §8): icons per item type. */
import { GraduationCap, Laptop, Route, Star, Target, Undo2, UserPlus, UserRound } from '@lucide/vue'
import type { Component } from 'vue'
import type { InboxItem, InboxItemType } from '~/types/api'

export const INBOX_ICONS: Record<InboxItemType, Component> = {
  'training.approval_required': GraduationCap,
  'training.booking_required': GraduationCap,
  'training.cancellation_review': Undo2,
  'training.rating_due': Star,
  'training.goals_missing': Target,
  'travel.approval_required': Route,
  'travel.booking_required': Route,
  'travel.cancellation_review': Undo2,
  'assets.acceptance_required': Laptop,
  'people.reply_required': UserRound,
  'people.triage_required': UserPlus,
}

export const inboxIcon = (item: Pick<InboxItem, 'type'>) => INBOX_ICONS[item.type] ?? GraduationCap

/** Quick actions post to `${actionsPath}/actions/{action}` (SPEC_RESOLUTIONS #4). */
export const quickActionPath = (item: Pick<InboxItem, 'actionsPath'>) => item.actionsPath
