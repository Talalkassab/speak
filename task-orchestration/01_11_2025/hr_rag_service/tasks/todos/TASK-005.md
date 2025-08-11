# TASK-005: Modify Auth UI for Multi-Tenant Support

**Priority**: P0 (Critical)  
**Phase**: Frontend Development - Day 2  
**Assigned Agent**: `frontend-developer.md`  
**Estimated Time**: 6 hours  
**Dependencies**: TASK-001 (Design System)  

## Objective
Modify the existing authentication UI components to support multi-tenant architecture, allowing organizations to register and manage their separate HR environments while maintaining the existing Supabase auth flow.

## Current State Analysis
Review the existing auth components in:
- `src/app/(auth)/auth-ui.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/auth-actions.ts`

## Acceptance Criteria
- [ ] Organization registration flow added to signup
- [ ] Company domain/subdomain selection implemented
- [ ] Multi-tenant user invitation system
- [ ] Role selection during signup (HR Manager/Staff/Viewer)
- [ ] Organization switching interface for multi-org users
- [ ] Arabic/English language support in auth forms
- [ ] RTL layout support for all auth components

## Detailed Requirements

### Organization Registration Flow
1. **New Organization Signup**
   ```typescript
   interface OrganizationSignup {
     companyName: string;
     companyDomain: string; // for subdomain/identification
     adminFirstName: string;
     adminLastName: string;
     adminEmail: string;
     password: string;
     phoneNumber: string;
     country: string; // defaulted to Saudi Arabia
     industry: string;
   }
   ```

2. **User Invitation Flow**
   - HR Manager can invite team members
   - Email invitation with organization context
   - Invited user signup with pre-filled org info
   - Role assignment during invitation

3. **Role Selection Interface**
   - HR Manager: Full access to all features
   - HR Staff: Limited access to daily operations
   - Viewer: Read-only access to reports and policies

### UI Components to Modify/Create

#### 1. Enhanced Signup Form (`SignupForm.tsx`)
- Add organization fields to existing form
- Conditional rendering for new org vs invited user
- Form validation for company domain uniqueness
- Progress indicator for multi-step signup

#### 2. Organization Switcher (`OrgSwitcher.tsx`)
- Dropdown showing available organizations
- Organization context persistence
- Smooth switching between orgs
- User permission display per org

#### 3. Invitation Management (`InviteManager.tsx`)
- Send invitation form
- Pending invitations list
- Resend/revoke invitation actions
- Bulk invitation import from CSV

#### 4. Role Selection Component (`RoleSelector.tsx`)
- Visual role cards with descriptions
- Permission preview for each role
- Role change request workflow

### Localization Support
- All text content in both Arabic and English
- RTL form layouts and input field alignment
- Cultural appropriate form field ordering
- Saudi phone number format validation

### Integration Points
- Maintain existing Supabase Auth integration
- Add organization context to all auth actions
- Update middleware to handle org-based routing
- Extend RLS policies to support multi-tenancy

## Technical Specifications

### Form Schema Updates
```typescript
// Extend existing auth schemas
const organizationSignupSchema = z.object({
  // Existing user fields
  email: z.string().email(),
  password: z.string().min(8),
  
  // New organization fields
  companyName: z.string().min(2).max(100),
  companyDomain: z.string().regex(/^[a-zA-Z0-9-]+$/),
  adminFirstName: z.string().min(1).max(50),
  adminLastName: z.string().min(1).max(50),
  phoneNumber: z.string().regex(/^(05)[0-9]{8}$/), // Saudi format
  industry: z.enum(['technology', 'healthcare', 'finance', 'retail', 'manufacturing', 'other'])
});
```

### Database Schema Considerations
```sql
-- New tables needed (will be created in backend phase)
organizations (
  id uuid primary key,
  name text not null,
  domain text unique not null,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

organization_members (
  id uuid primary key,
  organization_id uuid references organizations(id),
  user_id uuid references auth.users(id),
  role text not null check (role in ('admin', 'hr_manager', 'hr_staff', 'viewer')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz,
  created_at timestamptz default now()
);
```

## Deliverables
1. Modified `auth-ui.tsx` with organization support
2. New `OrganizationSignup.tsx` component
3. New `OrgSwitcher.tsx` component  
4. New `InviteManager.tsx` component
5. Updated `auth-actions.ts` with org-related functions
6. Arabic/English translation files for auth flows
7. RTL CSS updates for all auth components

## Testing Criteria
- [ ] New organization registration completes successfully
- [ ] User invitation emails are sent and processed
- [ ] Role-based access is visually indicated
- [ ] Organization switching works without auth issues
- [ ] All forms validate correctly in both languages
- [ ] RTL layout displays properly for Arabic users
- [ ] Existing auth flow remains unbroken

## Integration Notes
- Must work with existing Supabase RLS setup
- Organization context should be available globally
- Auth middleware needs org-aware routing
- Consider subdomain routing for future enhancement

## Files to Modify
- `src/app/(auth)/auth-ui.tsx`
- `src/app/(auth)/auth-actions.ts`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/middleware.ts` (org context)

## Files to Create
- `src/components/auth/OrganizationSignup.tsx`
- `src/components/auth/OrgSwitcher.tsx`
- `src/components/auth/InviteManager.tsx`
- `src/components/auth/RoleSelector.tsx`
- `src/locales/auth/ar.json`
- `src/locales/auth/en.json`

## Related Tasks
- Depends on: TASK-001 (Design System)
- Blocks: TASK-006 (Organization onboarding flow)
- Blocks: TASK-029 (Multi-tenant DB schema)
- Related: TASK-007 (Role selection interface)