"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";

type OrganizationMembership = {
  role: "owner" | "admin" | "member";
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type Member = {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
};

type MembersResponse = {
  organization: {
    id: string;
    name: string;
  };
  role: "owner" | "admin" | "member";
  memberships: OrganizationMembership[];
  selectedOrganizationId: string;
  members: Member[];
  invitations: Invitation[];
};

export default function OrganizationMembersPage() {
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [data, setData] = useState<MembersResponse | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const canManage = useMemo(
    () => data?.role === "owner" || data?.role === "admin",
    [data?.role]
  );

  const load = useCallback(async (organizationId?: string) => {
    const query = organizationId
      ? `?organizationId=${encodeURIComponent(organizationId)}`
      : "";
    const res = await fetch(`/api/settings/organization/members${query}`, { cache: "no-store" });
    const payload = (await res.json()) as MembersResponse & { error?: string };
    if (!res.ok) throw new Error(payload.error || "Failed to load organization members.");
    setData(payload);
    setSelectedOrganizationId(payload.selectedOrganizationId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "Failed to load organization members.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const invite = async () => {
    if (!data) return;
    if (!inviteEmail.trim()) {
      setNotice({ kind: "error", text: "Invite email is required." });
      return;
    }
    setInviting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Failed to invite member.");
      setInviteEmail("");
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Invitation sent." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to invite member.",
      });
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (memberUserId: string, role: "admin" | "member") => {
    if (!data) return;
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: data.organization.id,
          memberUserId,
          role,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to update role.");
      }
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Member role updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to update role.",
      });
    }
  };

  const removeMember = async (memberUserId: string) => {
    if (!data) return;
    setNotice(null);
    try {
      const res = await fetch(
        `/api/settings/organization/members?organizationId=${encodeURIComponent(
          data.organization.id
        )}&memberUserId=${encodeURIComponent(memberUserId)}`,
        { method: "DELETE" }
      );
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to remove member.");
      }
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Member removed." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to remove member.",
      });
    }
  };

  const revokeInvite = async (invitationId: string) => {
    if (!data) return;
    setNotice(null);
    try {
      const res = await fetch(
        `/api/settings/organization/members/invitations/${invitationId}?organizationId=${encodeURIComponent(
          data.organization.id
        )}`,
        { method: "DELETE" }
      );
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to revoke invitation.");
      }
      await load(data.organization.id);
      setNotice({ kind: "success", text: "Invitation revoked." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to revoke invitation.",
      });
    }
  };

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: Members</H1>
        <Paragraph color="$textMuted">Loading members...</Paragraph>
      </YStack>
    );
  }

  if (!data) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Organization: Members</H1>
        <Paragraph color="$textMuted">No organization found for this account.</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Organization: Members
        </H1>
        <Paragraph color="$textMuted">
          Invite teammates, manage roles, and control member access.
        </Paragraph>
      </YStack>

      {notice && (
        <XStack
          padding="$sm"
          borderRadius="$md"
          borderWidth={1}
          borderColor={notice.kind === "success" ? "$success" : "$error"}
          backgroundColor={notice.kind === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
        >
          <Text fontSize={13} color={notice.kind === "success" ? "$success" : "$error"}>
            {notice.text}
          </Text>
        </XStack>
      )}

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <YStack gap="$xs">
          <Text fontSize={13} color="$textMuted">
            Organization
          </Text>
          <select
            value={selectedOrganizationId}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setSelectedOrganizationId(next);
              void load(next);
            }}
            style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
          >
            {data.memberships.map((entry) => (
              <option key={entry.organization.id} value={entry.organization.id}>
                {entry.organization.name} ({entry.role})
              </option>
            ))}
          </select>
        </YStack>

        <YStack gap="$sm">
          <Text fontSize={15} fontWeight="600" color="$color">
            Invite member
          </Text>
          <XStack gap="$sm" flexWrap="wrap" alignItems="center">
            <Input
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="email@company.com"
              backgroundColor="$background"
              borderColor="$border"
              width={260}
              disabled={!canManage}
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.currentTarget.value as "admin" | "member")}
              disabled={!canManage}
              style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              size="$3"
              backgroundColor="$color"
              color="$background"
              onPress={invite}
              disabled={!canManage || inviting}
            >
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </XStack>
        </YStack>

        {!canManage && (
          <Paragraph color="$textMuted">
            You have read-only access. Ask an owner or admin to manage members.
          </Paragraph>
        )}
      </YStack>

      <YStack
        gap="$sm"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={15} fontWeight="600" color="$color">
          Members ({data.members.length})
        </Text>
        {data.members.map((member) => (
          <XStack
            key={member.id}
            justifyContent="space-between"
            alignItems="center"
            gap="$md"
            padding="$sm"
            borderRadius="$md"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$background"
          >
            <YStack flex={1}>
              <Text fontSize={14} color="$color">
                {member.user?.name || "Unknown user"}
              </Text>
              <Text fontSize={12} color="$textMuted">
                {member.user?.email || member.userId}
              </Text>
            </YStack>
            <XStack gap="$xs" alignItems="center">
              <Text fontSize={12} color="$textMuted">
                {member.role}
              </Text>
              {canManage && member.role !== "owner" && (
                <>
                  <select
                    value={member.role}
                    onChange={(event) =>
                      void updateRole(member.userId, event.currentTarget.value as "admin" | "member")
                    }
                    style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                  <Button
                    size="$2"
                    backgroundColor="$red10"
                    color="$background"
                    onPress={() => void removeMember(member.userId)}
                  >
                    Remove
                  </Button>
                </>
              )}
            </XStack>
          </XStack>
        ))}
      </YStack>

      <YStack
        gap="$sm"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <Text fontSize={15} fontWeight="600" color="$color">
          Pending invitations ({data.invitations.length})
        </Text>
        {data.invitations.length ? (
          data.invitations.map((invitation) => (
            <XStack
              key={invitation.id}
              justifyContent="space-between"
              alignItems="center"
              gap="$md"
              padding="$sm"
              borderRadius="$md"
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$background"
            >
              <YStack flex={1}>
                <Text fontSize={14} color="$color">
                  {invitation.email}
                </Text>
                <Text fontSize={12} color="$textMuted">
                  Role: {invitation.role}
                </Text>
              </YStack>
              {canManage && (
                <Button
                  size="$2"
                  backgroundColor="$red10"
                  color="$background"
                  onPress={() => void revokeInvite(invitation.id)}
                >
                  Revoke
                </Button>
              )}
            </XStack>
          ))
        ) : (
          <Paragraph color="$textMuted">No pending invitations.</Paragraph>
        )}
      </YStack>
    </YStack>
  );
}
