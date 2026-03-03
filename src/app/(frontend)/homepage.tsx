import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, MessageSquare, ShieldCheck, TrendingUp, Users, Zap } from 'lucide-react'
import Link from 'next/link'

export default async function HomePage() {
    return (
        <div className="flex flex-col min-h-screen -mt-[6.76rem]">
            {/* Hero Section */}
            <section className="relative  h-[100vh] flex items-center justify-center overflow-hidden">
                {/* Video Background */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute z-0 w-auto min-w-full min-h-full max-w-none filter brightness-[0.4]"
                >
                    <source src="/video/afno-diverse.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                </video>

                {/* Hero Content */}
                <div className="container relative z-10 text-center text-white space-y-8 pt-[14rem] md:pt-[7rem] lg:[0rem]">
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                            Elevate Your Events. <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                                Create Unforgettable Moments.
                            </span>
                        </h1>
                        <div className="text-xl md:text-2xl max-w-3xl mx-auto text-gray-300 space-y-6">
                            <p>Hi, we’re Afno Events.</p>

                            <p>
                                We help Nepalese event organisers across the UK promote their events,
                                reach wider audiences, and connect with the community more effectively.
                                By bringing Nepalese events into one dedicated platform, we make it
                                easier for people to discover what’s happening — helping organisers grow
                                attendance and build stronger community connections.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        {/* <Button size="lg" className="text-lg px-8 py-7 rounded-full shadow-lg hover:shadow-primary/20 transition-all">
                            Find Events
                        </Button> */}
                        <Link href="/contact-us">
                            <Button size="lg" variant="secondary" className="text-lg px-8 py-7 rounded-full bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-md text-white transition-all uppercase">
                                Sign Up My Event
                            </Button>
                        </Link>
                    </div>

                    {/* App Store Buttons in Hero */}
                    <div className="mb-8 flex flex-wrap items-center justify-center gap-6 pt-12 opacity-80 hover:opacity-100 transition-opacity">
                        <p className="w-full text-sm font-medium uppercase tracking-widest text-gray-400 mb-2">Download the Mobile App</p>
                        <Button variant="outline" className="bg-black/40 border-white/10 text-white rounded-xl py-6 px-6 flex items-center gap-3 hover:bg-black/60 transition-all">
                            <svg fill="hsl(var(--primary))" width="20px" height="20px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                            </svg>
                            <div className="text-left">
                                <p className="text-[10px] uppercase leading-none opacity-60">Download on the</p>
                                <p className="text-lg font-semibold leading-none">App Store</p>
                            </div>
                        </Button>
                        {/* <Button variant="outline" className="bg-black/40 border-white/10 text-white rounded-xl py-6 px-6 flex items-center gap-3 hover:bg-black/60 transition-all">
                            <PlayCircle size={28} />
                            <div className="text-left">
                                <p className="text-[10px] uppercase leading-none opacity-60">Get it on</p>
                                <p className="text-lg font-semibold leading-none">Google Play</p>
                            </div>
                        </Button> */}
                    </div>
                </div>
            </section>

            {/* Search & Discovery Section */}
            {/* <EventDiscovery /> */}

            {/* Why Us Section */}
            <section className="py-28 bg-muted/30 relative">
                <div className="container">
                    <div className="max-w-3xl mb-20">
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Built for Organizers,<br />Loved by Fans.</h2>
                        <p className="text-muted-foreground text-xl leading-relaxed">
                            Everything you need to sell tickets, manage attendees, and grow your event success from a single dashboard.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: Zap, title: "Low Fees", desc: "Maximize your profits with the lowest commission rates in the market. No hidden costs." },
                            { icon: Users, title: "Instant Payouts", desc: "Forget the wait. Access your earnings as tickets sell to keep your event momentum going." },
                            { icon: TrendingUp, title: "Powerful Analytics", desc: "Deep dive into attendee data and sales trends with our real-time, data-rich dashboard." },
                            { icon: ShieldCheck, title: "App Touch", desc: "Manage your E-ticket through the application for smooth journey till end." }
                        ].map((feature, i) => (feature &&
                            <div key={i} className="bg-card p-10 rounded-[2.5rem] border border-border space-y-6 hover:shadow-xl transition-all group">
                                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                                    <feature.icon size={32} />
                                </div>
                                <h3 className="text-2xl font-bold">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed text-lg">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Vendor & Partnership Section */}
            <section className="py-28 relative overflow-hidden bg-background border-y border-border">
                <div className="container grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-bold uppercase tracking-wider">
                            <MessageSquare size={16} />
                            Partnership Opportunities
                        </div>
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight">Become an <br />Afno Partner.</h2>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Are you Nepalese UK event organiser looking to reach thousands of attendees? Let’s discuss custom solutions and priority placements for your upcoming events.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <Link href="/contact-us">
                                <Button size="lg" variant="secondary" className="rounded-2xl h-16 px-8 text-lg font-bold flex items-center gap-2">
                                    Create Event <ArrowRight size={20} />
                                </Button>
                            </Link>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square bg-gradient-to-tr from-primary/20 to-blue-500/10 rounded-[3rem] absolute -inset-4 -rotate-3 blur-2xl -z-10" />
                        <div className="bg-card border border-border p-12 rounded-[3.5rem] shadow-2xl space-y-8">
                            <h3 className="text-3xl font-bold">Quick Inquiry</h3>
                            <div className="space-y-5">
                                <Input placeholder="Full Name" className="h-14 rounded-xl px-6" />
                                <Input placeholder="Organization Name" className="h-14 rounded-xl px-6" />
                                <Input placeholder="Email Address" type="email" className="h-14 rounded-xl px-6" />
                                <Button className="w-full h-16 rounded-xl text-lg font-bold shadow-lg shadow-primary/20">Send Message</Button>
                            </div>
                            <p className="text-center text-sm text-muted-foreground">
                                Our team typically responds within 24 hours.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section / App Showcase */}
            <section className="py-28 bg-primary text-primary-foreground relative overflow-hidden rounded-md">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[50rem] h-[50rem] bg-white/10 rounded-full blur-[120px]" />
                <div className="container text-center space-y-12 relative z-10">
                    <div className="space-y-6">
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight">Experience events on the go.</h2>
                        <p className="text-xl md:text-2xl opacity-80 max-w-3xl mx-auto">
                            Scan tickets, browse new events, and manage your bookings anytime, anywhere.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
                        <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 rounded-2xl h-16 px-10 flex items-center gap-4 transition-all hover:scale-105">
                            <svg fill="#000000" width="28px" height="28px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                            </svg>
                            <div className="text-left">
                                <p className="text-xs uppercase font-bold opacity-60">Soon on the</p>
                                <p className="text-xl font-extrabold">App Store</p>
                            </div>
                        </Button>
                        {/* <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 rounded-2xl h-20 px-10 flex items-center gap-4 transition-all hover:scale-105">
                            <PlayCircle size={32} />
                            <div className="text-left">
                                <p className="text-xs uppercase font-bold opacity-60">Soon on</p>
                                <p className="text-xl font-extrabold">Google Play</p>
                            </div>
                        </Button> */}
                    </div>

                    <div className="pt-12">
                        <p className="text-primary-foreground/60 text-lg mb-8">Ready to host your next big thing?</p>
                        <Link href="/contact-us">
                            <Button size="lg" variant="secondary" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary px-12 py-8 text-xl rounded-full font-bold transition-all">
                                SIGN UP YOUR EVENT
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}
