/**
 * The navigation (SCREENS.md §1.2). Written once by the foundation and covering every route, so
 * slices never edit it (SPEC §1 shared-file protocol). Slices add **badges** through
 * `app/modules/<module>/badges.ts` and **commands** through `app/modules/<module>/commands.ts`.
 */
import {
  ClipboardList,
  GraduationCap,
  Inbox,
  Laptop,
  Newspaper,
  Route,
  ScrollText,
  Sunrise,
  Timer,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
} from '@lucide/vue'
import { BACK_OFFICE } from '~/lib/access'
import type { NavGroup } from '~/types/navigation'

export const navigation: NavGroup[] = [
  {
    id: 'work',
    label: null,
    items: [
      { id: 'home', label: 'Home', to: '/', icon: Sunrise, shortcut: ['g', 'h'] },
      { id: 'inbox', label: 'Inbox', to: '/inbox', icon: Inbox, shortcut: ['g', 'i'] },
      {
        id: 'training',
        label: 'Training',
        to: '/training',
        icon: GraduationCap,
        shortcut: ['g', 't'],
        match: ['/training/new', '/training/participations', '/training/requests'],
        children: [
          {
            id: 'training.approvals',
            label: 'Approvals',
            to: '/training/approvals',
            access: ['approver'],
          },
          { id: 'training.ratings', label: 'Ratings', to: '/training/ratings' },
        ],
      },
      {
        id: 'travel',
        label: 'Travel',
        to: '/travel',
        icon: Route,
        shortcut: ['g', 'v'],
        match: ['/travel/new', '/travel/requests'],
        children: [
          {
            id: 'travel.approvals',
            label: 'Approvals',
            to: '/travel/approvals',
            access: ['manager', 'deputy'],
          },
        ],
      },
      { id: 'assets', label: 'My devices', to: '/assets', icon: Laptop, shortcut: ['g', 'a'] },
      {
        id: 'people',
        label: 'People requests',
        to: '/people-requests',
        icon: UsersRound,
        shortcut: ['g', 'p'],
      },
      { id: 'news', label: 'News', to: '/news', icon: Newspaper },
    ],
  },
  {
    id: 'back-office',
    label: 'Back office',
    items: [
      {
        id: 'back-office.training',
        label: 'Training office',
        to: '/back-office/training',
        icon: GraduationCap,
        access: BACK_OFFICE.training,
        children: [
          {
            id: 'back-office.training.requests',
            label: 'All requests',
            to: '/back-office/training/requests',
            access: BACK_OFFICE.training,
          },
          {
            id: 'back-office.training.ratings',
            label: 'Ratings overview',
            to: '/back-office/training/ratings',
            access: BACK_OFFICE.training,
          },
        ],
      },
      {
        id: 'back-office.travel',
        label: 'Travel desk',
        to: '/back-office/travel',
        icon: Route,
        access: BACK_OFFICE.travel,
        children: [
          {
            id: 'back-office.travel.car-classes',
            label: 'Car classes',
            to: '/back-office/travel/car-classes',
            access: BACK_OFFICE.travel,
          },
        ],
      },
      {
        id: 'back-office.assets',
        label: 'Asset admin',
        to: '/back-office/assets',
        icon: Laptop,
        access: BACK_OFFICE.assets,
        children: [
          {
            id: 'back-office.assets.inventory',
            label: 'Inventory',
            to: '/back-office/assets/inventory',
            access: BACK_OFFICE.assets,
          },
          {
            id: 'back-office.assets.models',
            label: 'Models',
            to: '/back-office/assets/models',
            access: BACK_OFFICE.assets,
          },
          {
            id: 'back-office.assets.catalog',
            label: 'Catalogue',
            to: '/back-office/assets/catalog',
            access: BACK_OFFICE.assets,
          },
        ],
      },
      {
        id: 'back-office.people',
        label: 'People ops',
        to: '/back-office/people',
        icon: UserPlus,
        access: BACK_OFFICE.people,
        children: [
          {
            id: 'back-office.people.job-roles',
            label: 'Job roles',
            to: '/back-office/people/job-roles',
            access: BACK_OFFICE.people,
          },
        ],
      },
      {
        id: 'back-office.news',
        label: 'News',
        to: '/back-office/news',
        icon: Newspaper,
        access: BACK_OFFICE.news,
        children: [
          {
            id: 'back-office.links',
            label: 'Useful links',
            to: '/back-office/links',
            access: BACK_OFFICE.news,
          },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { id: 'admin.users', label: 'Users', to: '/admin/users', icon: Users, access: ['it_admin'] },
      {
        id: 'admin.audit',
        label: 'Audit log',
        to: '/admin/audit',
        icon: ScrollText,
        access: ['it_admin'],
      },
      { id: 'admin.jobs', label: 'Jobs', to: '/admin/jobs', icon: Timer, access: ['it_admin'] },
    ],
  },
  {
    // Shown in the account menu and ⌘K, not in the sidebar (DESIGN §7 + comps).
    id: 'settings',
    label: 'Settings',
    hideInSidebar: true,
    items: [
      { id: 'settings.deputies', label: 'Deputies', to: '/settings/deputies', icon: ClipboardList },
      { id: 'settings.profile', label: 'Profile', to: '/settings/profile', icon: UserRound },
    ],
  },
]
