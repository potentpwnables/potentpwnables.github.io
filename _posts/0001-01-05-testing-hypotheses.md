---
title: Testing Hypothesis to Avoid Rabbit Holes in Investigations
author: ''
date: '2022-11-20'
slug: testing-hypotheses
categories: []
tags:
  - investigations
  - r
type: ''
subtitle: ''
image: ''
readtime: true
---

Back in 2016 I was working for the Manhattan District Attorney’s Office,
and my job was to investigate money laundering and terrorist financing.
Because the US Dollar (USD) serves as the dominant reserve currency and
is used to conduct international trade and financial transactions, and
because all USD transactions must go through a US bank, and because the
largest US banks are all headquartered in Manhattan, our office had
jurisdiction on these types of cases. Our leads would come from several
sources, but it likely serves as no surprise that one such source was
the news. So, one day, I’m sitting at my desk reading the Wall Street
Journal, and I come across [an
article](https://www.wsj.com/articles/how-islamic-states-secret-banking-network-prospers-1456332138)
that was talking about how ISIS was moving its money. Within the
article, they mentioned a specific shipping company that was being used
by ISIS to transfer funds and utilize its logistic network to ship
goods. Going through the usual process of issuing subpoenas to all of
the major banks for any accounts associated with the shipping company, I
got lucky and had a few hits. As I was perusing the financial records, I
noticed something strange: there were several transactions in which this
shipping company was *sending* money to what appeared to be people
unaffiliated with the business, who all lived within 3 miles of each
other. In investigations like this, there is always a trade off to
including a new asset or not. For any given business or individual that
is added to a case, the investigator must issue subpoenas to the major
banks, phone providers, and email providers in order to get any relevant
information. This means writing subpoenas, getting them signed, sending
them out, waiting for the documents to come back, and then reading
through all of that data and linking it to other data you have. This is
an incredibly time consuming process, and there lies the rub. Should I
add these assets to the investigation? Was the fact that they lived so
close to each other actually as suspicious as I felt it was?

## The Hypothesis

When conducting investigations, you’re bound to have several hypotheses
that develop along the way, and it’s useful to have a framework by which
to test those hypotheses. In this post, I’m going to recreate the
analysis I used to determine if we should issue subpoenas for the
aforementioned individuals to show how a little bit of computer
programming can help save hours of data analysis. So, let’s phrase the
above hypothesis - individuals receiving money from a company of
interest living that close together is suspicious - into a question that
can be answered with an experiment.

**What is the probability that three individuals chosen at random from
this city would live within 3 miles of each other?**

## The Approach

In order to test this analysis, we’re going to use a [Monte Carlo
Simulation](https://en.wikipedia.org/wiki/Monte_Carlo_method) to
randomly choose three “addresses” in a city and then measure how far
apart those addresses are from each other. We’ll repeat this process one
million times, keeping track of the average distance ((d<sub>12</sub> +
d<sub>13</sub> + d<sub>23</sub>) / 3, where d<sub>12</sub> is the
distance between person 1 and person 2) each time, and then we’ll plot a
histogram of those distances to get a sense of the distribution of
addresses. In order to choose which “address” to choose, or in other
words where to place a point on our map, we’ll use the population
density of census tracts as our weight. This will help ensure that we
account for the fact that people are not typically uniformly distributed
throughout a city, but instead tend to cluster towards downtown and city
center areas. I’m also going to cheat a little bit and simply use the
[Euclidean Distance](https://en.wikipedia.org/wiki/Euclidean_distance)
for this analysis. According to [this
blog](https://blog.codechef.com/2021/08/30/the-algorithms-behind-the-working-of-google-maps-dijkstras-and-a-star-algorithm/#:~:text=Which%20algorithm%20do%20they%20use,defined%20by%20edges%20and%20vertices.),
Google Maps takes advantage of two distance algorithms:
[Djikstra’s](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm) and
[A\*](https://en.wikipedia.org/wiki/A*_search_algorithm). However, these
distance algorithms are used on graph data, which we aren’t working with
in this example. There is also the [Manhattan
Distance](https://en.wikipedia.org/wiki/Taxicab_geometry), but that’s
more complicated than I’d like to get into. I mean, it’s not like we’re
submitting this analysis into court; we’re just trying to decide if we
want to investigate these people at all.

So, in summary, our approach is to randomly place three dots inside of a
city map using the population density as a means to choose where to
place those points. We’ll do this one million times and calculate the
Euclidean distance between all three points each time, and then create a
graph at the end that shows the distrubtion of distances.

## The Data

In order to test this hypothesis, we’ll need to do the following:

1.  Choose a city where we want our hypothetical people to live.  
2.  Download the census tracts for that city.  
3.  Download the population demographics for those census tracts.  
4.  Randomly place 3 points inside of our shapefile using the population
    density.  
5.  Repeat step 4 one million times.

For this experiment, I’m going to use Detroit as the city. While I’m
sure most people would assume this, I think it’s worth explicitly
stating that this is *not* the city in which these individuals from the
case lived. It is, however, a city near and dear to my heart, so we’ll
work with that. I’m going to use R for this analysis, and will be
relying on the `dplyr`, `tigris`, `tidycensus`, `ggplot2`, and `sf`
packages to conduct my geospatial analysis. I used used a couple of blog
posts ([1](https://rpubs.com/walkerke/tigris),
[2](https://www.jla-data.net/eng/merging-geometry-of-sf-objects-in-r/))
to get me up and running with a preliminary analysis, which you can read
through if you’re curious to learn more. We’ll also need the shape file
for Detroit’s city boundary. As you may have seen in the blog post I
linked, the `tigris` package will grab shapefiles for a county, but
Wayne County holds more than just Detroit. We can use the two shapefiles
to conduct an intersection to get just the data that we need. So, with
that being said, let’s dive into grabbing the data. Let’s start by
grabbing the Detroit city boundary shape file, which can be downloaded
from
[here](https://data.detroitmi.gov/datasets/detroitmi::city-of-detroit-boundary/explore?location=42.352615%2C-83.099114%2C11.97).

Once that’s downloaded, let’s load that into R, and also grab the Wayne
County census tracts. We can then plot the city boundary for the city of
Detroit to confirm that we’ve loaded it.

    library(dplyr)
    library(tigris)
    library(tidycensus)
    library(sf)
    library(ggplot2)

    detroit <- st_read("detroit_boundaries/City_of_Detroit_Boundary.shp", quiet=T)

    # to get the values for state and county run lookup_codes("Michigan", "Wayne")
    wayne_county <- tracts(state=26, county=163, year=2021)

    ggplot() +
        geom_sf(data=detroit) +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank()
        ) + 
        labs(x="City of Detroit")

    ## Warning: package 'dplyr' was built under R version 4.2.2

    ## Warning: package 'tidycensus' was built under R version 4.2.2

    ## Warning: package 'sf' was built under R version 4.2.2

    ##   |                                                                              |                                                                      |   0%  |                                                                              |                                                                      |   1%  |                                                                              |=                                                                     |   1%  |                                                                              |=                                                                     |   2%  |                                                                              |==                                                                    |   2%  |                                                                              |==                                                                    |   3%  |                                                                              |===                                                                   |   4%  |                                                                              |===                                                                   |   5%  |                                                                              |====                                                                  |   5%  |                                                                              |====                                                                  |   6%  |                                                                              |=====                                                                 |   7%  |                                                                              |=====                                                                 |   8%  |                                                                              |======                                                                |   8%  |                                                                              |======                                                                |   9%  |                                                                              |=======                                                               |   9%  |                                                                              |=======                                                               |  10%  |                                                                              |=======                                                               |  11%  |                                                                              |========                                                              |  11%  |                                                                              |========                                                              |  12%  |                                                                              |=========                                                             |  12%  |                                                                              |=========                                                             |  13%  |                                                                              |==========                                                            |  14%  |                                                                              |==========                                                            |  15%  |                                                                              |===========                                                           |  15%  |                                                                              |===========                                                           |  16%  |                                                                              |============                                                          |  16%  |                                                                              |============                                                          |  17%  |                                                                              |============                                                          |  18%  |                                                                              |=============                                                         |  18%  |                                                                              |=============                                                         |  19%  |                                                                              |==============                                                        |  20%  |                                                                              |==============                                                        |  21%  |                                                                              |===============                                                       |  21%  |                                                                              |===============                                                       |  22%  |                                                                              |================                                                      |  22%  |                                                                              |================                                                      |  23%  |                                                                              |================                                                      |  24%  |                                                                              |=================                                                     |  24%  |                                                                              |=================                                                     |  25%  |                                                                              |==================                                                    |  25%  |                                                                              |==================                                                    |  26%  |                                                                              |===================                                                   |  26%  |                                                                              |===================                                                   |  27%  |                                                                              |===================                                                   |  28%  |                                                                              |====================                                                  |  28%  |                                                                              |====================                                                  |  29%  |                                                                              |=====================                                                 |  29%  |                                                                              |=====================                                                 |  30%  |                                                                              |=====================                                                 |  31%  |                                                                              |======================                                                |  31%  |                                                                              |======================                                                |  32%  |                                                                              |=======================                                               |  32%  |                                                                              |=======================                                               |  33%  |                                                                              |========================                                              |  34%  |                                                                              |========================                                              |  35%  |                                                                              |=========================                                             |  35%  |                                                                              |=========================                                             |  36%  |                                                                              |==========================                                            |  36%  |                                                                              |==========================                                            |  37%  |                                                                              |==========================                                            |  38%  |                                                                              |===========================                                           |  38%  |                                                                              |===========================                                           |  39%  |                                                                              |============================                                          |  40%  |                                                                              |============================                                          |  41%  |                                                                              |=============================                                         |  41%  |                                                                              |=============================                                         |  42%  |                                                                              |==============================                                        |  42%  |                                                                              |==============================                                        |  43%  |                                                                              |==============================                                        |  44%  |                                                                              |===============================                                       |  44%  |                                                                              |===============================                                       |  45%  |                                                                              |================================                                      |  45%  |                                                                              |================================                                      |  46%  |                                                                              |=================================                                     |  46%  |                                                                              |=================================                                     |  47%  |                                                                              |=================================                                     |  48%  |                                                                              |==================================                                    |  48%  |                                                                              |==================================                                    |  49%  |                                                                              |===================================                                   |  49%  |                                                                              |===================================                                   |  50%  |                                                                              |===================================                                   |  51%  |                                                                              |====================================                                  |  51%  |                                                                              |====================================                                  |  52%  |                                                                              |=====================================                                 |  53%  |                                                                              |======================================                                |  54%  |                                                                              |======================================                                |  55%  |                                                                              |=======================================                               |  55%  |                                                                              |=======================================                               |  56%  |                                                                              |========================================                              |  56%  |                                                                              |========================================                              |  57%  |                                                                              |========================================                              |  58%  |                                                                              |=========================================                             |  58%  |                                                                              |=========================================                             |  59%  |                                                                              |==========================================                            |  60%  |                                                                              |==========================================                            |  61%  |                                                                              |===========================================                           |  61%  |                                                                              |===========================================                           |  62%  |                                                                              |============================================                          |  62%  |                                                                              |============================================                          |  63%  |                                                                              |============================================                          |  64%  |                                                                              |=============================================                         |  64%  |                                                                              |=============================================                         |  65%  |                                                                              |==============================================                        |  65%  |                                                                              |==============================================                        |  66%  |                                                                              |===============================================                       |  67%  |                                                                              |===============================================                       |  68%  |                                                                              |================================================                      |  68%  |                                                                              |================================================                      |  69%  |                                                                              |=================================================                     |  69%  |                                                                              |=================================================                     |  70%  |                                                                              |=================================================                     |  71%  |                                                                              |==================================================                    |  71%  |                                                                              |==================================================                    |  72%  |                                                                              |===================================================                   |  72%  |                                                                              |===================================================                   |  73%  |                                                                              |====================================================                  |  74%  |                                                                              |====================================================                  |  75%  |                                                                              |=====================================================                 |  75%  |                                                                              |=====================================================                 |  76%  |                                                                              |======================================================                |  77%  |                                                                              |======================================================                |  78%  |                                                                              |=======================================================               |  78%  |                                                                              |=======================================================               |  79%  |                                                                              |========================================================              |  79%  |                                                                              |========================================================              |  80%  |                                                                              |=========================================================             |  81%  |                                                                              |=========================================================             |  82%  |                                                                              |==========================================================            |  82%  |                                                                              |==========================================================            |  83%  |                                                                              |===========================================================           |  84%  |                                                                              |===========================================================           |  85%  |                                                                              |============================================================          |  85%  |                                                                              |============================================================          |  86%  |                                                                              |=============================================================         |  87%  |                                                                              |=============================================================         |  88%  |                                                                              |==============================================================        |  88%  |                                                                              |==============================================================        |  89%  |                                                                              |===============================================================       |  89%  |                                                                              |===============================================================       |  90%  |                                                                              |===============================================================       |  91%  |                                                                              |================================================================      |  91%  |                                                                              |================================================================      |  92%  |                                                                              |=================================================================     |  93%  |                                                                              |==================================================================    |  94%  |                                                                              |==================================================================    |  95%  |                                                                              |===================================================================   |  95%  |                                                                              |===================================================================   |  96%  |                                                                              |====================================================================  |  97%  |                                                                              |====================================================================  |  98%  |                                                                              |===================================================================== |  98%  |                                                                              |===================================================================== |  99%  |                                                                              |======================================================================| 100%

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/library_load-1.png)

Excellent! We’ve got the city of Detroit mapped out, and now we need to
add in the census tracts. We already have the census tract data
downloaded thanks to the `detroit_census_tracts <- tracts(...)` code we
ran above. The problem, however, as mentioned before, is that the census
tract data is for the entire Wayne County, so we need to prune that
data. This can be achieved by intersecting our polygons and only keeping
the data that overlaps. Think of this like an `inner join` on two SQL
tables.

    detroit_census_tracts = st_intersection(detroit, wayne_county)

    ## Error in geos_op2_geom("intersection", x, y, ...): st_crs(x) == st_crs(y) is not TRUE

Whoops! Looks like we’re dealing with two different coordinate reference
systems (CRS). I’m not overly interested in learning how the various CRS
systems work, so I’m going to sort of skip the part where I’d start
reading about what this is and how it’s affecting my work. Again, if
this were for an investigation going to court, and I was expected to
explain my analyses, you can bet your ass I’d be digging into CRS. But
this is a blog post and we all have better things to do. So let’s just
figure out which CRS each object is using and choose one to make them
the same.

    print(st_crs(detroit))

    ## Coordinate Reference System:
    ##   User input: WGS 84 
    ##   wkt:
    ## GEOGCRS["WGS 84",
    ##     DATUM["World Geodetic System 1984",
    ##         ELLIPSOID["WGS 84",6378137,298.257223563,
    ##             LENGTHUNIT["metre",1]]],
    ##     PRIMEM["Greenwich",0,
    ##         ANGLEUNIT["degree",0.0174532925199433]],
    ##     CS[ellipsoidal,2],
    ##         AXIS["latitude",north,
    ##             ORDER[1],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##         AXIS["longitude",east,
    ##             ORDER[2],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##     ID["EPSG",4326]]

    print(st_crs(wayne_county))

    ## Coordinate Reference System:
    ##   User input: NAD83 
    ##   wkt:
    ## GEOGCRS["NAD83",
    ##     DATUM["North American Datum 1983",
    ##         ELLIPSOID["GRS 1980",6378137,298.257222101,
    ##             LENGTHUNIT["metre",1]]],
    ##     PRIMEM["Greenwich",0,
    ##         ANGLEUNIT["degree",0.0174532925199433]],
    ##     CS[ellipsoidal,2],
    ##         AXIS["latitude",north,
    ##             ORDER[1],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##         AXIS["longitude",east,
    ##             ORDER[2],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##     ID["EPSG",4269]]

WGS 84 is a CRS that I recognize from the limited geospatial work I’ve
done in the past, so I’m going to choose that one, which means we’ll
need to transform our `wayne_county` object.

    wayne_county_wgs84 <- st_transform(wayne_county, crs=st_crs(detroit))
    print(st_crs(wayne_county_wgs84))

    ## Coordinate Reference System:
    ##   User input: WGS 84 
    ##   wkt:
    ## GEOGCRS["WGS 84",
    ##     DATUM["World Geodetic System 1984",
    ##         ELLIPSOID["WGS 84",6378137,298.257223563,
    ##             LENGTHUNIT["metre",1]]],
    ##     PRIMEM["Greenwich",0,
    ##         ANGLEUNIT["degree",0.0174532925199433]],
    ##     CS[ellipsoidal,2],
    ##         AXIS["latitude",north,
    ##             ORDER[1],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##         AXIS["longitude",east,
    ##             ORDER[2],
    ##             ANGLEUNIT["degree",0.0174532925199433]],
    ##     ID["EPSG",4326]]

Assuming that that’s all we need to do, we should be able to do our
intersection now.

    detroit_census_tracts = st_intersection(detroit, wayne_county_wgs84)

    ## Warning: attribute variables are assumed to be spatially constant throughout all
    ## geometries

And we should now be able to plot it.

    ggplot() +
        geom_sf(data=detroit_census_tracts) +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank()
        ) +
        labs(x="Detroit Census Tracts")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/plot_detroit_census-1.png)

Nailed it! Lastly, we need to grab the population data for each census
tract. We can use the `tidycensus` package for this, which is an R
package designed to facilitate the process of acquiring and working with
US Census Bureau population data in the R environment
<sub>[1](https://walker-data.com/census-r/an-introduction-to-tidycensus.html)</sub>.
Identifying the variable to use for general population estimates is a
bit of a pain in the ass, but the short answer is that `B01001_001`
should get us what we need. We’re also using the year 2020 because
that’s the lastest year for which the 5-year ACS was run.

    wayne_population <- get_acs(
        geography="tract",
        variables="B01001_001",
        state="MI",
        county="Wayne",
        year=2020
    )

    ## Getting data from the 2016-2020 5-year ACS

Ah, we need an API key. Let’s set that up really quick by first [signing
up](http://api.census.gov/data/key_signup.html), and then installing the
key as recommended by the error message.

    census_api_key(key="<INSERT YOUR KEY HERE>", install=TRUE)

If successful, you should see a message akin to this:

    Your API key has been stored in your .Renviron and can be accessed by Sys.getenv("CENSUS_API_KEY"). 
    To use now, restart R or run `readRenviron("~/.Renviron")`
    [1] "<YOUR API KEY>"

Now that we have our API key and have run `readRenviron("~/.Renviron")`
recommended in the output, we should be able to get back to the business
at hand.

    wayne_population <- get_acs(
        geography="tract",
        variables="B01001_001",
        state="MI",
        county="Wayne",
        year=2020
    )

    ## Getting data from the 2016-2020 5-year ACS

    head(wayne_population)

    ## # A tibble: 6 × 5
    ##   GEOID       NAME                                      variable   estim…¹   moe
    ##   <chr>       <chr>                                     <chr>        <dbl> <dbl>
    ## 1 26163500100 Census Tract 5001, Wayne County, Michigan B01001_001    3417   606
    ## 2 26163500200 Census Tract 5002, Wayne County, Michigan B01001_001    2852   541
    ## 3 26163500300 Census Tract 5003, Wayne County, Michigan B01001_001    1657   332
    ## 4 26163500400 Census Tract 5004, Wayne County, Michigan B01001_001    1322   384
    ## 5 26163500500 Census Tract 5005, Wayne County, Michigan B01001_001    1233   229
    ## 6 26163500600 Census Tract 5006, Wayne County, Michigan B01001_001    2707   578
    ## # … with abbreviated variable name ¹​estimate

So, it looks like we’ll need to intersect this data with our census
tracts to only get the population estimates for Detroit census tracts.
Since each row in the acs data should be a census tract, we should be
able to do a simple join on the two data sets to get what we need.

    detroit_census_with_pop <- wayne_population |>
        select(GEOID, estimate) |>
        right_join(detroit_census_tracts, by="GEOID")

    ggplot() +
        geom_sf(data=detroit_census_with_pop, aes(geometry=geometry, fill=estimate)) +
        scale_fill_viridis_c() +
        theme(
            panel.grid.major=element_blank(), 
            panel.grid.minor=element_blank(),
            panel.background=element_blank(),
            axis.text.x=element_blank(),
            axis.ticks.x=element_blank(),
            axis.text.y=element_blank(),
            axis.ticks.y=element_blank(),
            legend.position="bottom"
        ) +
        labs(x="2020 Estimated Detroit Population by Census Tract")

![](/assets/posts/0001-01-05-testing-hypotheses_files/figure-markdown_strict/add_population_data-1.png)

Voila! We now have all of the data that we need to conduct our
simulation.

## The Analysis

Our next step is to figure out how to place a point somewhere on our map
using the estimated population for each census tract to help us choose
where our hypothetical people live.
