---
title: Investigating a Web Server Breach - Part I
author: ''
date: '2022-12-03'
slug: investigating-web-server-breach-part-i
categories: []
tags:
  - ctf
  - windows
  - registry
type: ''
subtitle: ''
image: ''
readtime: true
---

This is one of many posts in a series I’ll be doing on [a
CTF](https://www.ashemery.com/dfir.html#Challenge1) offered by [Ali
Hadi](https://twitter.com/binaryz0ne). The CTF looks at a web server
breach and asks us to answer several questions in order to complete the
challenge. In an effort to avoid an incredibly long blog post, I’ll be
breaking this up by question, with some questions potentially taking
more than one post. You can find the chronological list of posts below,
which will be updated as more posts are added.

1. [Analyzing the SAM Hive and security events log](https://tibblesnbits.com/posts/investigating-web-server-breach-part-i)  
2. [Analyzing the web server logs](https://tibblesnbits.com/posts/investigating-web-server-breach-part-ii)

## Assumptions

Before jumping in, there are a couple of assumptions I’m going to make
about you as the reader:

-   You’re interested in understanding how this analysis would look on a
    Windows machine.  
-   You know about tools like [FTK
    Imager](https://accessdata.com/product-download/ftk-imager-version-4-5)
    and [Volatility](https://www.volatilityfoundation.org/releases).  
-   You’re familiar with the basics of the Windows Registry, including
    its SAM, SECURITY, SOFTWARE, SYSTEM, and NTUSER hives.  
-   You’re familiar with the concept of the Windows Security Log and its
    corresponding Event IDs.

If any of these are completely foreign to you, I would pause here and
spend some time familiarizing yourself with those concepts.

## The Question

The first question posed in this CTF is “what type of attacks has been
performed on the box?”, and because I’m new to DFIR and just starting to
get my feet wet, I decided to skip this question for now. It just feels
hard to answer without doing a thorough analysis of the data, and I was
hoping for a couple quick wins to build some momentum. So let’s go to
question two, which seems a little easier. Or at least a little more
straightforward.

**How many users has the attacker(s) added to the box, and how were they
added?**

As I mentioned above, I assume that you’re familiar with at least the
basics of the Windows Registry and its Hives, so I’m hoping that it’s no
surprise that my first thought was to go to the SAM Hive. According to
[Wikipedia](https://en.wikipedia.org/wiki/Security_Account_Manager), the
SAM Hive, which stands for Security Account Manager, is a database file
that stores users’ passwords. What it doesn’t explicitly state is that
the SAM Hive can also tell us what users exist on a box, when they were
added, what group(s) they belong to, how many times they’ve logged in
(both successfully and unsuccessfully), and a bunch of other stuff.
Wikipedia also tells us where to find this file:
`%SystemRoot%/system32/config/SAM`. So let’s open our disk image in FTK
Imager and navigate there to see if we can identify any users that an
attacker may have added to the web server.

## The SAM Hive

If we click each of the plus symbols next to the headings until we’ve
opened the `root` directory, we’ll see what should be a familiar
directory structure for anyone who has used a Windows machine before.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/ftk_imager_fig_1.png" alt="Image of the s4a-challenge4 file loaded in FTK Imager" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 1 - The s4a-challenge4 file as
seen in FTK Imager</span>
</figcaption>
</figure>

Navigating to `root\Windows\system32\config` and clicking on the
`config` directory shows a list of files at that location in the File
List pane. And lo and behold, there’s our SAM hive. Unfortunately,
simply clicking on the file doesn’t yield the most readable data. FTK
Imager allows you to toggle between Text and Hex mode (those little
icons in the toolbar that look like glasses labeled “TEXT” and “HEX”),
but this probably isn’t the most efficient way to get the information we
want. Thankfully there are tools that can help us with this. I don’t
remember where I learned about Eric Zimmerman’s tools, but if you
read/watch enough DFIR tutorials, you’re bound to come across the name.
[Eric Zimmerman’s Tools](https://ericzimmerman.github.io/#!index.md) are
apparently highly regarded in the industry, so I opted to use their
Registry Explorer tool to look at the SAM file.

*Note: EZ’s Tools are broken down by .NET version, either 4 or 6. The VM
I’m running has .NET v7, so I chose the second link in the row. If
you’re using a version &gt;=4 and &lt;6, use the first link, otherwise
update your .NET to an appropriate version.*

Once the tool has been downloaded, we’ll need to extract the SAM Hive
from the disk image, which FTK Imager makes incredibly easy for us. If
we right-click the file, we see there’s an option to export it. Once
that’s downloaded, we can launch `RegistryExplorer.exe`, and then load
our Hive via `File > Load Hive`. Figure 2 below shows what you should
see immediately after loading your SAM Hive.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/reg_explorer_fig_2.png" alt="Image of the SAM Hive loaded in Registry Explorer" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 2 - The SAM Hive file as seen in
Registry Explorer</span>
</figcaption>
</figure>

Now, we could navigate through all of the folders in the directory, but
one of the nice things about Registry Explorer is that it provides
shortcuts called “Bookmarks” that for a given Hive type allows you to
dig into the most common data points. For example, with the SAM Hive,
Registry Explorer gives us the “Users” shortcut (found by going to
`Bookmarks > Common > Users`), which pulls up a table of users that
exist on the machine, as well as some other information. Immediately,
we’re able to see a user that should pique our interest.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/user_table_fig_3.png" alt="Image of the User Accounts table" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 3 - The User Accounts Table found
in the SAM Hive</span>
</figcaption>
</figure>

The first user I noticed was one named “hacker” (user ID 1006). The tool
states that this user was created on September 2nd, 2015 at 09:05:25;
however, I’m not sure what time zone this timestamp is using, which is a
rather important piece of information. While Googling for what time zone
Eric Zimmerman’s tools use didn’t net me the answer I was looking for, I
was able to identify a registry key that would tell me the timezone the
computer was using: `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\TimeZoneInformation`.

Let’s take a quick tangent and load the SOFTWARE Hive using the same
approach we did with the SAM Hive - use FTK Imager to extract the file,
and then use Registry Explorer to open it - and find that data point.
Again, because Registry Explorer has several bookmarks that come with
the tool by default, our job is pretty easy for us as
“TimeZoneInformation” is one of the bookmarks. Looking at this
information, we can see that the server is using Pacific Standard Time.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/timezone_information_fig_4.png" alt="Image of the Time Zone Information table" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 4 - The TimeZoneInformation
registry key found in the SOFTWARE Hive</span>
</figcaption>
</figure>

## The Answer

It’ll be important to keep this time and timezone in mind as we use
other tools to solicit information to ensure that we’re able to
cross-reference data points. But for now, we know that this user was
created at the date and time stated above. What’s interesting about that
is that there’s a second user, `user1 (1005)`, that was created 19
seconds prior to the `hacker` account. So, at this point, I think we can
conclude that the attacker(s) added two accounts: `user1` and `hacker`.
Of course, my mind now immediately goes to questions like “could they
have created other users but deleted them” and “could they have created
a user that didn’t show up in this data”. This is mostly due to the fact
that I don’t fully understand how this data is logged and what processes
control what shows up and what doesn’t. But, for now, I think we can
safely say it’s just these two users, but as I continue building my DFIR
skill set, questions like that are what I hope I’ll learn how to answer.

## Digging Deeper

The question also prompts us to answer *how* the users were added. This
is one of the first places where things go wonky for me for two
particular reasons. The first is due to a misunderstanding of what a
certain data point would tell me. Windows Security Event Logs will track
whenever a user is created with Event ID 4720, which you can read more
about
[here](https://www.ultimatewindowssecurity.com/securitylog/encyclopedia/event.aspx?eventID=4720).
If you open that page and scroll towards the bottom, you’ll see a
section called “Examples of 4720”. I knew (from prior DFIR tutorials and
work experience) that Event ID 4720 would tell you *who* created a user
account, but I erroneously thought that it would give you the process
used to create that user, thus answering the *how*. Unfortunately, as
you can see in example provided on that site, this isn’t true. And I
would have learned that if not for the second thing that threw me
through a loop.

To see what that is, we need to figure out how to even view the Security
Event Log. If we Google for “windows security event logs location” and
ignore the results that are talking about the SECURITY Hive, come across
[this
article](https://learn.microsoft.com/en-us/troubleshoot/windows-server/application-management/move-event-viewer-log-files)
that tells us that by default Event Viewer log files are stored in the
`%SytemRoot%\System32\winevt\Logs` folder. So, we’ll go back to FTK
Imager, navigate to that directory, and export that file.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/winevt_log_fig_5.png" alt="Image of the files located in the winevt/Logs directory" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 5 - Subset of files located at
%SystemRoot%</span>
</figcaption>
</figure>

Once we navigate to this directory, we’ll want to extract the
`Security.evtx` file the same way we’ve been extracting the other files
(right click and choose to export). Now, I’m conducting my analysis on a
Windows VM, which means I have access to the Windows Event Viewer
program. I’m not sure how you’d do this on a Linux machine, but I’m sure
there are a number of tools available that could get it done. I’m going
to open this in Event Viewer though, which I can do by choosing the
“Open Saved Log…” option from the right-hand side of the application.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/event_viewer_fig_6.png" alt="Image of the Security Event Log loaded in Event Viewer" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 6 - Subset of events as seen in the Event Viewer</span>
</figcaption>
</figure>

Now that that’s loaded, we can click “Filter Current Log…” on the
right-hand side of the application, and choose to include only specific
Event IDs. We’ll filter down to just the 4720 events so that we can see
the logs for when our two users were added.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/empty_event_log_fig_7.png" alt="Image of the results of filtering down to event 4720. No events are shown." style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 7 - Results of filtering down to
Event ID 4720</span>
</figcaption>
</figure>

Umm… what?

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/whered-all-my-data-go.jpg" alt="A meme of Milton from Office Space saying he was told there would be data" style="width:100%;" />
</figure>

I don’t know enough about Windows web servers, the security event logs,
or policies that surround when/if an event is logged to know if this is
suspicious or not, but it definitely *seems* suspicious. And it only
gets more suspicious the more we dig in. For example, we know that the
users of interest were created on September 2nd around 9am PST. So while
we know there are not 4720 events, we could at least look at the events
that took place around that time. Once again we can filter the logs, but
this time focusing on timestamps instead of events. If we filter down to
events that occurred between 12:00am and 11:59pm on September 2nd, 2015,
and then scroll down a bit, we’ll notice what appears to be an anomaly.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/subset_of_sep_2nd_events_fig_8.png" alt="Image of the subset of results of filtering down to events that took place on September 2nd, 2015." style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 8 - Subset of events that took
place on September 2nd, 2015 highlighting a 19-hour gap</span>
</figcaption>
</figure>

If we click on the second event that is highlight, the one that is
categorized as a “Security State Change”, then we will see that,
ostensibly, `VBoxService.exe` changed the system time, pushing it
forward by 19 hours.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/suspicious_event_fig_9.png" alt="Image event ID 4616 showing the system time was changed" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 9 - Event ID 4616 showing that
C:.exe changed the system time</span>
</figcaption>
</figure>

Included in the event’s information is the following snippet:

> This event is generated when the system time is changed. It is normal
> for the Windows Time Service, which runs with System privilege, to
> change the system time on a regular basis. Other system time changes
> may be indicative of attempts to tamper with the computer.

So, given that the time jumps forward past when the attacker(s) added
the users to the server, and the fact that Windows specifically notes
that other system time changes could be attempts to tamper with the
computer, this appears to be very suspicious. And to make matters even
worse, if we go back to FTK Imager, and then navigate to
`C:\Windows\System32`, we can see that the `VBoxService.exe` file
doesn’t exist.

## Conclusion

Let’s leave it there for now. We’ve identified two users that were added
to the computer, as well as identified some suspicious activity in the
logs. Next time I’m going to explore more logs, including the web server
logs, and see what we can see there.
