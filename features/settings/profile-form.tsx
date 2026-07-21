"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateProfileAction } from "@/features/settings/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
  organization,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  organization: string | null;
}) {
  const [values, setValues] = useState({
    firstName,
    lastName,
    phone: phone ?? "",
    organization: organization ?? "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await updateProfileAction(values);
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success("Profile updated.");
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal details, as shown across Persona AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-first-name">First name</Label>
              <Input
                id="settings-first-name"
                value={values.firstName}
                onChange={(event) => setValues((prev) => ({ ...prev, firstName: event.target.value }))}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-last-name">Last name</Label>
              <Input
                id="settings-last-name"
                value={values.lastName}
                onChange={(event) => setValues((prev) => ({ ...prev, lastName: event.target.value }))}
                maxLength={60}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Your email is your sign-in identifier and can&apos;t be changed here.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-phone">Phone (optional)</Label>
              <Input
                id="settings-phone"
                value={values.phone}
                onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+91 98765 43210"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-organization">Organization (optional)</Label>
              <Input
                id="settings-organization"
                value={values.organization}
                onChange={(event) => setValues((prev) => ({ ...prev, organization: event.target.value }))}
                placeholder="e.g. Acme Pvt Ltd"
                maxLength={120}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
