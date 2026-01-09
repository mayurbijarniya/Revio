"use client";

import { FileCode, GitPullRequest, AlertCircle } from "lucide-react";
import Image from "next/image";

export function TerminalPreview() {
    return (
        <div className="w-full h-full bg-[#0d1117] text-gray-300 font-mono text-xs flex flex-col overflow-hidden">
            {/* Window Title Bar */}
            <div className="h-8 border-b border-gray-800 flex items-center px-3 sm:px-4 justify-between bg-[#161b22]">
                <div className="flex gap-1.5 sm:gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]"></div>
                </div>
                <div className="text-gray-500 text-[9px] sm:text-[10px] truncate max-w-[150px] sm:max-w-none">revio-agent — pr-review</div>
                <div className="w-8 sm:w-10"></div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Hidden on mobile */}
                <div className="w-52 lg:w-64 border-r border-gray-800 bg-[#0d1117] p-3 lg:p-4 hidden md:flex flex-col gap-4 lg:gap-6">
                    <div>
                        <div className="text-[9px] lg:text-[10px] uppercase text-gray-500 font-bold mb-2 lg:mb-3 tracking-wider">Open Review</div>
                        <div className="flex items-center gap-2 text-white bg-[#1f6feb]/10 p-2 rounded border border-[#1f6feb]/20">
                            <GitPullRequest className="w-3 h-3 lg:w-4 lg:h-4 text-[#1f6feb]" />
                            <span className="font-semibold text-[10px] lg:text-xs">fix: auth-flow</span>
                        </div>
                    </div>

                    <div>
                        <div className="text-[9px] lg:text-[10px] uppercase text-gray-500 font-bold mb-2 lg:mb-3 tracking-wider">Changed Files</div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800/50 rounded cursor-pointer text-blue-400 text-[10px] lg:text-xs">
                                <FileCode className="w-3 h-3" />
                                <span>auth.ts</span>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800/50 rounded cursor-pointer opacity-70 text-[10px] lg:text-xs">
                                <FileCode className="w-3 h-3" />
                                <span>user-model.go</span>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800/50 rounded cursor-pointer opacity-70 text-[10px] lg:text-xs">
                                <FileCode className="w-3 h-3" />
                                <span>api_test.py</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Code View */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* File Tab */}
                    <div className="h-8 sm:h-9 border-b border-gray-800 flex items-center px-3 sm:px-4 bg-[#0d1117]">
                        <span className="text-blue-400 flex items-center gap-2 text-[10px] sm:text-xs truncate">
                            <FileCode className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">src/lib/auth.ts</span>
                        </span>
                    </div>

                    {/* Code Area */}
                    <div className="flex-1 p-3 sm:p-4 overflow-hidden relative">
                        <div className="space-y-0.5 sm:space-y-1 font-mono text-[9px] sm:text-[11px] leading-relaxed opacity-90">
                            <div className="flex gap-2 sm:gap-4 opacity-50"><span className="w-4 sm:w-6 text-right select-none">12</span> <span className="truncate">export const validateSession = async (token: string) =&gt; {'{'}</span></div>
                            <div className="flex gap-2 sm:gap-4 opacity-50"><span className="w-4 sm:w-6 text-right select-none">13</span> <span>  if (!token) return null;</span></div>
                            <div className="flex gap-2 sm:gap-4 opacity-50"><span className="w-4 sm:w-6 text-right select-none">14</span> <span>  try {'{'}</span></div>

                            {/* Diff: Delete */}
                            <div className="flex gap-2 sm:gap-4 bg-red-900/20 text-red-300 w-full -ml-3 sm:-ml-4 pl-3 sm:pl-4 border-l-2 border-red-500">
                                <span className="w-4 sm:w-6 text-right select-none opacity-50">-</span>
                                <span className="truncate">    const decoded = jwt.verify(token, process.env.SECRET);</span>
                            </div>

                            {/* Diff: Add */}
                            <div className="flex gap-2 sm:gap-4 bg-green-900/20 text-green-300 w-full -ml-3 sm:-ml-4 pl-3 sm:pl-4 border-l-2 border-green-500 animate-pulse">
                                <span className="w-4 sm:w-6 text-right select-none opacity-50">+</span>
                                <span className="truncate">    const decoded = await verifyTokenSecurely(token);</span>
                            </div>

                            <div className="flex gap-2 sm:gap-4 opacity-50"><span className="w-4 sm:w-6 text-right select-none">16</span> <span>    return decoded;</span></div>
                            <div className="flex gap-2 sm:gap-4 opacity-50"><span className="w-4 sm:w-6 text-right select-none">17</span> <span>  {'}'} catch (e) {'{'}</span></div>
                            <div className="flex gap-2 sm:gap-4 opacity-50 hidden sm:flex"><span className="w-4 sm:w-6 text-right select-none">18</span> <span>    console.error(&quot;Auth error&quot;, e);</span></div>
                            <div className="flex gap-2 sm:gap-4 opacity-50 hidden sm:flex"><span className="w-4 sm:w-6 text-right select-none">19</span> <span>    return null;</span></div>
                        </div>

                        {/* AI Comment Overlay - Responsive */}
                        <div className="absolute right-2 sm:right-4 lg:right-8 top-2 sm:top-4 lg:top-16 w-[calc(100%-1rem)] sm:w-64 lg:w-72 bg-[#161b22] border border-gray-700 rounded-lg shadow-2xl p-2 sm:p-3 animate-in fade-in slide-in-from-right-4 duration-700">
                            <div className="flex items-center gap-2 mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-800">
                                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded overflow-hidden flex-shrink-0">
                                    <Image src="/logo.svg" alt="AI" width={16} height={16} className="w-full h-full object-contain" />
                                </div>
                                <span className="font-bold text-gray-300 text-[10px] sm:text-xs">Revio Analysis</span>
                            </div>
                            <p className="text-gray-400 mb-1.5 sm:mb-2 leading-tight text-[9px] sm:text-[10px] lg:text-xs">
                                <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline text-green-400 mr-1" />
                                Security improvement detected. Using async verification prevents blocking.
                            </p>
                            <div className="flex gap-2 mt-1.5 sm:mt-2">
                                <button className="flex-1 py-1 bg-green-900/30 text-green-400 text-[8px] sm:text-[10px] rounded border border-green-900 hover:bg-green-900/50">Approve Fix</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
