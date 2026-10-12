/**
 * Core seed: the organisation (users, manager hierarchy) and the demo personas.
 * Runs before every module seed, so modules can reference users via ctx.db.users.
 *
 * TODO(2b): align personas/roles with _spec/atrium/API.md + SCREENS.md.
 */
import type { Role } from '~/types/auth'
import { defineMockSeed } from '../define'
import type { MockUser } from './types'

export const LOCATIONS = ['Riverton', 'Hillford', 'Eastgate'] as const

export const DEPARTMENTS = [
  { name: 'Field Services', costCenter: 'CC-2100' },
  { name: 'Service Desk', costCenter: 'CC-2200' },
  { name: 'Logistics', costCenter: 'CC-2300' },
  { name: 'Finance', costCenter: 'CC-3100' },
  { name: 'People Operations', costCenter: 'CC-3200' },
  { name: 'IT', costCenter: 'CC-3300' },
] as const

interface PersonaSpec {
  key: string
  firstName: string
  lastName: string
  jobTitle: string
  department: string
  costCenter: string
  location: string
  manager: string | null
  roles: Role[]
  description: string
}

/** Stable ids so links, tests and bookmarks keep working across reseeds. */
const personaId = (index: number) =>
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`

const PERSONAS: PersonaSpec[] = [
  {
    key: 'emma.employee',
    firstName: 'Emma',
    lastName: 'Employee',
    jobTitle: 'Field Technician',
    department: 'Field Services',
    costCenter: 'CC-2100',
    location: 'Riverton',
    manager: 'mark.manager',
    roles: ['employee'],
    description: 'Regular employee: requests training and travel, accepts devices.',
  },
  {
    key: 'mark.manager',
    firstName: 'Mark',
    lastName: 'Manager',
    jobTitle: 'Team Lead Field Services',
    department: 'Field Services',
    costCenter: 'CC-2100',
    location: 'Riverton',
    manager: 'erin.executive',
    roles: ['employee', 'manager'],
    description: 'Line manager: approves requests of the team.',
  },
  {
    key: 'erin.executive',
    firstName: 'Erin',
    lastName: 'Executive',
    jobTitle: 'Managing Director',
    department: 'Management',
    costCenter: 'CC-1000',
    location: 'Riverton',
    manager: null,
    roles: ['employee', 'manager', 'executive'],
    description: 'Executive: approves high-cost training.',
  },
  {
    key: 'tina.training',
    firstName: 'Tina',
    lastName: 'Training',
    jobTitle: 'Training Coordinator',
    department: 'People Operations',
    costCenter: 'CC-3200',
    location: 'Hillford',
    manager: 'erin.executive',
    roles: ['employee', 'training_admin'],
    description: 'Training office: books and tracks trainings.',
  },
  {
    key: 'trevor.travel',
    firstName: 'Trevor',
    lastName: 'Travel',
    jobTitle: 'Travel Desk Agent',
    department: 'Finance',
    costCenter: 'CC-3100',
    location: 'Eastgate',
    manager: 'erin.executive',
    roles: ['employee', 'travel_admin'],
    description: 'Travel desk: books cars, trains and flights.',
  },
  {
    key: 'ian.it',
    firstName: 'Ian',
    lastName: 'Admin',
    jobTitle: 'IT Administrator',
    department: 'IT',
    costCenter: 'CC-3300',
    location: 'Hillford',
    manager: 'erin.executive',
    roles: [
      'employee',
      'it_admin',
      'asset_admin',
      'people_admin',
      'news_editor',
      'training_admin',
      'travel_admin',
    ],
    description: 'IT superuser: sees every admin area.',
  },
]

export default defineMockSeed({
  order: 0,
  run({ db, faker }) {
    const idByKey = new Map(PERSONAS.map((persona, index) => [persona.key, personaId(index)]))

    PERSONAS.forEach((persona, index) => {
      db.users.insert({
        id: personaId(index),
        email: `${persona.key}@example.com`,
        firstName: persona.firstName,
        lastName: persona.lastName,
        displayName: `${persona.firstName} ${persona.lastName}`,
        jobTitle: persona.jobTitle,
        department: persona.department,
        costCenter: persona.costCenter,
        location: persona.location,
        managerId: persona.manager ? (idByKey.get(persona.manager) ?? null) : null,
        roles: persona.roles,
        active: true,
        persona: { description: persona.description, order: index },
      })
    })

    // A small organisation around the personas: two extra team leads, each with a team,
    // plus colleagues in Mark Manager's team.
    const markId = idByKey.get('mark.manager')!
    const erinId = idByKey.get('erin.executive')!
    const usedEmails = new Set(db.users.all().map((user) => user.email))

    const createEmployee = (managerId: string, roles: Role[], jobTitle: string): MockUser => {
      const department = faker.helpers.arrayElement(DEPARTMENTS)
      let firstName = faker.person.firstName()
      let lastName = faker.person.lastName()
      let email = `${firstName}.${lastName}@example.com`.toLowerCase().replace(/[^a-z.@-]/g, '')
      while (usedEmails.has(email)) {
        firstName = faker.person.firstName()
        lastName = faker.person.lastName()
        email = `${firstName}.${lastName}@example.com`.toLowerCase().replace(/[^a-z.@-]/g, '')
      }
      usedEmails.add(email)
      return db.users.insert({
        id: faker.string.uuid(),
        email,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        jobTitle,
        department: department.name,
        costCenter: department.costCenter,
        location: faker.helpers.arrayElement(LOCATIONS),
        managerId,
        roles,
        active: true,
        persona: null,
      })
    }

    const leads = [
      createEmployee(erinId, ['employee', 'manager'], 'Team Lead Service Desk'),
      createEmployee(erinId, ['employee', 'manager'], 'Team Lead Logistics'),
    ]
    for (let index = 0; index < 8; index++) {
      createEmployee(markId, ['employee'], faker.person.jobTitle())
    }
    for (const lead of leads) {
      for (let index = 0; index < 10; index++) {
        createEmployee(lead.id, ['employee'], faker.person.jobTitle())
      }
    }
  },
})
