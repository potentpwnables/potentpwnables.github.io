This is the first of what I assume will be a series of blog posts on a
CTF I’ve been doing related to a fake web server that was breached. The
challenge can be found
[here](https://www.ashemery.com/dfir.html#Challenge1) if you’re
interested in trying it yourself. The challenge itself doesn’t provide
too much by way of hints other than to tell you that it’s a web server
that was breached and we have a forensic image of the server as well as
a memory dump. Given that this is my first DFIR CTF, I’m going to take
it a little slow and really dig into the various things that pique my
interest. So, with that, let’s dig in.

If you’re new to digital forensics like I am, you may not even know
where to start with the two files that we have. For example, how do you
even go about accessing them? That’s where I started, but I’m not going
to go into a lot of detail here about the tools for two reasons:

1.  I don’t know them well enough to sit here and pretend like I can
    talk about them with any confidence, and  
2.  there are a ton of resources out there for these tools (blogs,
    YouTube videos, etc) that already exist.

Instead, I’d rather walk through how I was thinking about this
challenge, what caught my eye, where I wasted a bunch of time, etc. The
objective of this post isn’t to serve as a walkthrough of the challenge
(you can find those
[here](https://betweentwodfirns.blogspot.com/2017/03/ashemerycom-challenge-1-web-server-case.html)
and
[here](https://syedhasan010.medium.com/digital-forensics-write-up-web-server-case-by-ali-hadi-340f6d919f9c)),
but instead to demonstrate my thought process, and to help potential
employers see how I’d go about these types of analyses *wink wink*. So
let’s dive in.

# The Disk Image

I started by analyzing the disk image because it seemed more
approachable to me. Using [FTK
Imager](https://accessdata.com/product-download/ftk-imager-version-4-5)
(v4.5.0.3), I was able to load the file as an Image and start perusing
what was on the server at the time the image was made, which can be seen
below in *Figure 1*.

<figure>
<img src="/assets/posts/0001-01-06-investigating-web-server-breach_files/figure_1_file_tree.png" alt="Image of the Evidence Tree loaded in FTK Imager" style="width:100%;" />
<figcaption align="center">
<span style="font-style:italic">Figure 1 - Evidence Tree as Seen in FTK
Imager</span>
</figcaption>
</figure>
