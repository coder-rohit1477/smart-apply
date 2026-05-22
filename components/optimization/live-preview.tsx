"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, ExternalLink, Award, BookOpen, Briefcase, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePreviewProps {
  data: any;
  className?: string;
}

export function LivePreview({ data, className }: LivePreviewProps) {
  if (!data) return null;

  return (
    <Card className={cn("bg-white text-slate-900 shadow-xl overflow-hidden min-h-[800px]", className)}>
      <CardContent className="p-12 space-y-8">
        {/* Header */}
        <header className="border-b-2 border-slate-900 pb-6 text-center">
          <h1 className="text-4xl font-black tracking-tight uppercase mb-2">{data.fullName || "Your Name"}</h1>
          <div className="flex flex-wrap justify-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
            {data.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {data.email}</span>}
            {data.phoneNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {data.phoneNumber}</span>}
            {data.headline && <span className="flex items-center gap-1 text-slate-900">{data.headline}</span>}
          </div>
        </header>

        {/* Summary */}
        {data.summary && (
          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-900">
              <span className="h-2 w-2 bg-slate-900" />
              Professional Summary
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 italic">
              {data.summary}
            </p>
          </section>
        )}

        {/* Experience */}
        {data.experience && data.experience.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-900">
              <span className="h-2 w-2 bg-slate-900" />
              Professional Experience
            </h2>
            <div className="space-y-6">
              {data.experience.map((exp: string, i: number) => (
                <div key={i} className="text-sm leading-relaxed text-slate-700">
                  <div className="pl-4 border-l-2 border-slate-200">
                    {exp.split('\n').map((line, j) => (
                      <p key={j} className={cn(j === 0 ? "font-bold text-slate-900 mb-1" : "mb-1")}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {data.skills && data.skills.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-900">
              <span className="h-2 w-2 bg-slate-900" />
              Technical Proficiencies
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.skills.map((skill: any, i: number) => (
                <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 border border-slate-200">
                  {skill.name || skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {data.education && data.education.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-900">
              <span className="h-2 w-2 bg-slate-900" />
              Academic Credentials
            </h2>
            <div className="space-y-3">
              {data.education.map((edu: string, i: number) => (
                <p key={i} className="text-sm text-slate-700 font-medium">
                  {edu}
                </p>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
