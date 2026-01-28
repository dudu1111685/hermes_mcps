# Groups Management

## Create Group
```bash
POST /api/{session}/groups
{
  "name": "Group name",
  "participants": [
    { "id": "123123123123@c.us" }
  ]
}
```

## List Groups
```bash
GET /api/{session}/groups?limit=100&offset=0&sortBy=subject&sortOrder=desc

# Filters:
# - sortBy: id, subject
# - sortOrder: desc, asc
# - exclude=participants (skip participants data)
```

## Join Group via Invite
```bash
POST /api/{session}/groups/join
{ "code": "https://chat.whatsapp.com/invitecode" }
# OR
{ "code": "invitecode" }
```

## Get Group Info
```bash
GET /api/{session}/groups/{groupId}
GET /api/{session}/groups/join-info?code=invitecode  # Preview before join
```

## Refresh Groups
```bash
POST /api/{session}/groups/refresh
```
⚠️ Don't call frequently (rate-overlimit risk)

## Update Group

### Subject (Name)
```bash
PUT /api/{session}/groups/{groupId}/subject
{ "subject": "New Group Name" }
```

### Description
```bash
PUT /api/{session}/groups/{groupId}/description
{ "description": "New description" }
```

### Picture
```bash
# Set
PUT /api/{session}/groups/{groupId}/picture
{
  "file": {
    "url": "https://example.com/image.jpg"
    # OR "data": "base64..."
  }
}

# Get
GET /api/{session}/groups/{groupId}/picture?refresh=false

# Delete
DELETE /api/{session}/groups/{groupId}/picture
```

## Participants Management

### Get Participants
```bash
GET /api/{session}/groups/{groupId}/participants
GET /api/{session}/groups/{groupId}/participants/v2  # Consistent format
```

**Roles:**
- `left` - left the group
- `participant` - regular
- `admin` - admin
- `superadmin` - super admin

### Add Participants
```bash
POST /api/{session}/groups/{groupId}/participants/add
{
  "participants": [
    { "id": "123123123123@c.us" }
  ]
}
```

### Remove Participants
```bash
POST /api/{session}/groups/{groupId}/participants/remove
{
  "participants": [
    { "id": "123123123123@c.us" }
  ]
}
```

## Admin Management

### Promote to Admin
```bash
POST /api/{session}/groups/{groupId}/admin/promote
{
  "participants": [
    { "id": "123123123123@c.us" }
  ]
}
```

### Demote to Participant
```bash
POST /api/{session}/groups/{groupId}/admin/demote
{
  "participants": [
    { "id": "123123123123@c.us" }
  ]
}
```

## Security Settings

### Who Can Edit Group Info
```bash
PUT /api/{session}/groups/{groupId}/settings/security/info-admin-only
{ "adminsOnly": true }

GET /api/{session}/groups/{groupId}/settings/security/info-admin-only
```

### Who Can Send Messages
```bash
PUT /api/{session}/groups/{groupId}/settings/security/messages-admin-only
{ "adminsOnly": true }

GET /api/{session}/groups/{groupId}/settings/security/messages-admin-only
```

## Invite Code Management

### Get Invite Code
```bash
GET /api/{session}/groups/{groupId}/invite-code
# Returns: "invitecode"
# Share as: https://chat.whatsapp.com/invitecode
```

### Revoke Invite Code
```bash
POST /api/{session}/groups/{groupId}/invite-code/revoke
```

## Leave/Delete Group
```bash
# Leave
POST /api/{session}/groups/{groupId}/leave

# Delete (admin only)
DELETE /api/{session}/groups/{groupId}
```

## Group Events

### group.v2.join
You joined or were added:
```json
{
  "event": "group.v2.join",
  "payload": {
    "group": {
      "id": "1231231232@g.us",
      "subject": "Work Group",
      "description": "...",
      "invite": "https://chat.whatsapp.com/xxx",
      "membersCanAddNewMember": true,
      "membersCanSendMessages": true,
      "newMembersApprovalRequired": false,
      "participants": [
        { "id": "99999@c.us", "role": "participant" }
      ]
    },
    "timestamp": 789456123
  }
}
```

### group.v2.leave
You left or were removed:
```json
{
  "event": "group.v2.leave",
  "payload": {
    "group": { "id": "1231231232@g.us" },
    "timestamp": 789456123
  }
}
```

### group.v2.participants
Someone joined/left/promoted/demoted:
```json
{
  "event": "group.v2.participants",
  "payload": {
    "type": "join",  # join/leave/promote/demote
    "timestamp": 1666943582,
    "group": { "id": "123456789@g.us" },
    "participants": [
      { "id": "123456789@c.us", "role": "participant" }
    ]
  }
}
```

### group.v2.update
Group info updated:
```json
{
  "event": "group.v2.update",
  "payload": {
    "group": {
      "id": "1231231232@g.us",
      "subject": "New Name"
    },
    "timestamp": 789456123
  }
}
```

## Best Practices
1. **Group IDs:** Format `12312312123133@g.us`
2. **Refresh:** Only when seeing inconsistencies
3. **Rate Limits:** Don't spam add/remove operations
4. **Permissions:** Check admin status before operations
5. **Invite Links:** Revoke regularly for security
